/**
 * Excel / CSV parsing + template generation for bulk imports.
 *
 * Uses `exceljs` (already a project dep) so we don't add another CSV/xlsx
 * library. The parser intentionally tolerates extra trailing blank rows
 * and strips whitespace from headers — Excel users are inconsistent.
 */

import ExcelJS from "exceljs"

/** Pads a number to a 2-digit string ("3" → "03"). */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/**
 * Picks the calendar day a Date most likely "meant" when parsed from Excel.
 *
 *   - If UTC wall-time is midnight → use UTC components.
 *   - Else if local wall-time is midnight → use local components.
 *   - Otherwise fall back to local components (mixed-time cells are rare
 *     in bulk imports — we prefer to give the user the locally-displayed
 *     date rather than silently jumping a day).
 *
 * Returns "YYYY-MM-DD".
 */
function extractCalendarDate(d: Date): string {
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * Normalises a single exceljs cell value into the narrow set our
 * downstream pipeline understands: string / number / boolean / null.
 *
 * exceljs returns cell values in many shapes depending on the source
 * XML — primitives for plain cells, `Date` for date cells, and a
 * grab-bag of objects for formulas, rich text, hyperlinks, shared
 * formulas and error cells. A previous version of this code used a
 * `String(value)` catch-all for unrecognised objects, which silently
 * produced the literal `"[object Object]"` and:
 *
 *   1. Tricked the empty-row guard into keeping otherwise-empty rows
 *      (a deleted-but-formatted cell would make a phantom row pass
 *      validation as far as "has data", then fail every required-field
 *      check), and
 *   2. Hid legitimate formula results from the schema (e.g. a city
 *      name produced by a VLOOKUP would never reach `obj[header]`).
 *
 * The cases below cover every documented exceljs cell shape; anything
 * we genuinely don't recognise becomes `null` rather than a synthetic
 * string, so it can't pollute the empty-row check or downstream zod
 * parsing.
 */
function normaliseCellValue(
  value: unknown,
): string | number | boolean | null {
  if (value == null) return null
  if (value instanceof Date) return extractCalendarDate(value)
  if (typeof value === "number" || typeof value === "boolean") return value
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed === "" ? null : trimmed
  }
  if (typeof value === "object") {
    const v = value as Record<string, unknown>
    // Formula / shared formula cells: trust the evaluated result.
    if ("result" in v) return normaliseCellValue(v.result)
    // Error cells (e.g. #N/A, #REF!) — treat as no value rather than
    // letting the error sigil leak into the dataset.
    if ("error" in v) return null
    // Rich-text array: join the segments' text.
    if (Array.isArray(v.richText)) {
      const text = (v.richText as Array<{ text?: unknown }>)
        .map((seg) => (typeof seg?.text === "string" ? seg.text : ""))
        .join("")
        .trim()
      return text === "" ? null : text
    }
    // Hyperlink / inline-text shapes: { text, hyperlink? } or { text: { richText: [...] } }
    if ("text" in v) {
      const t = v.text
      if (typeof t === "string") {
        const trimmed = t.trim()
        return trimmed === "" ? null : trimmed
      }
      // Nested rich-text inside `text` (exceljs does this for some hyperlink cells).
      if (t && typeof t === "object") return normaliseCellValue(t)
    }
    // Unknown object shape — drop rather than coerce to "[object Object]".
    return null
  }
  // Any other primitive (bigint, symbol) — coerce safely.
  const s = String(value).trim()
  return s === "" ? null : s
}

export type ParsedSheet = {
  /** Header row, as captured from the file (post-trim). */
  headers: string[]
  /** Data rows keyed by header. Cells are coerced to strings; numeric cells
   *  are kept as numbers so per-field zod preprocess can decide. */
  rows: Array<Record<string, string | number | boolean | null>>
  /** Original file name when available — useful for the job audit row. */
  fileName?: string
}

/**
 * Reads the first sheet of an Excel/CSV file. Always returns the first
 * worksheet; multi-sheet files emit a soft warning via console.
 */
export async function parseImportFile(
  buffer: ArrayBuffer | Buffer,
  fileName?: string,
): Promise<ParsedSheet> {
  const workbook = new ExcelJS.Workbook()
  const isCsv = fileName?.toLowerCase().endsWith(".csv")
  // Normalise to a fresh ArrayBuffer copy that exceljs accepts.
  const ab = (() => {
    if (buffer instanceof ArrayBuffer) return buffer
    const u8 = new Uint8Array(buffer)
    const out = new ArrayBuffer(u8.byteLength)
    new Uint8Array(out).set(u8)
    return out
  })()
  if (isCsv) {
    const { Readable } = await import("node:stream")
    const stream = Readable.from(Buffer.from(new Uint8Array(ab)))
    await workbook.csv.read(stream)
  } else {
    await workbook.xlsx.load(ab)
  }

  const ws = workbook.worksheets[0]
  if (!ws) return { headers: [], rows: [], fileName }
  if (workbook.worksheets.length > 1) {
    console.warn(`[bulk-imports] file has ${workbook.worksheets.length} sheets — only the first is parsed`)
  }

  const headerRow = ws.getRow(1)
  const headers: string[] = []
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const raw = String(cell.text ?? cell.value ?? "").trim()
    headers[colNumber - 1] = raw
  })
  // collapse trailing empty header slots
  while (headers.length > 0 && !headers[headers.length - 1]) headers.pop()

  const rows: ParsedSheet["rows"] = []
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const obj: Record<string, string | number | boolean | null> = {}
    let hasAnyValue = false
    headers.forEach((header, idx) => {
      if (!header) return
      const cell = row.getCell(idx + 1)
      const normalised = normaliseCellValue(cell.value)
      if (normalised !== null && normalised !== "") hasAnyValue = true
      obj[header] = normalised
    })
    if (hasAnyValue) rows.push(obj)
  })

  return { headers, rows, fileName }
}

/**
 * Generates a downloadable .xlsx template for a definition. The first row
 * is the header set; sample rows (if any) are written below as worked
 * examples.
 */
export async function buildTemplateXlsx(opts: {
  module: string
  subModule?: string
  label: string
  requiredHeaders: string[]
  optionalHeaders?: string[]
  sampleRows?: Array<Record<string, string | number>>
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Parwest ERP"
  wb.created = new Date()

  const sheetName = (opts.subModule || opts.module).slice(0, 31)
  const ws = wb.addWorksheet(sheetName)

  const allHeaders = [...opts.requiredHeaders, ...(opts.optionalHeaders ?? [])]
  ws.columns = allHeaders.map((h) => ({
    header: h,
    key: h,
    width: Math.min(Math.max(h.length + 4, 14), 36),
  }))

  // Make required headers visually distinct.
  const headerRow = ws.getRow(1)
  headerRow.eachCell((cell, colNumber) => {
    const isRequired = colNumber <= opts.requiredHeaders.length
    cell.font = { bold: true, color: { argb: isRequired ? "FFFFFFFF" : "FF000000" } }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isRequired ? "FF1A56DB" : "FFE5E7EB" },
    }
    cell.alignment = { vertical: "middle", horizontal: "center" }
  })
  headerRow.height = 22

  for (const sample of opts.sampleRows ?? []) {
    ws.addRow(sample)
  }

  // README-style note row at the bottom.
  ws.addRow([])
  const noteRow = ws.addRow([
    `Template for ${opts.label}. Required columns: ${opts.requiredHeaders.join(", ") || "(none)"}.`,
  ])
  noteRow.font = { italic: true, color: { argb: "FF6B7280" } }
  ws.mergeCells(noteRow.number, 1, noteRow.number, Math.max(allHeaders.length, 1))

  const arr = await wb.xlsx.writeBuffer()
  return Buffer.from(arr as ArrayBuffer)
}

/**
 * Generates an .xlsx file containing the failed rows + an `__error_reason`
 * column. Pass the original parsed sheet rows + the row-error list.
 */
export async function buildErrorReportXlsx(opts: {
  label: string
  headers: string[]
  /** All originally-parsed rows in order. */
  rows: Array<Record<string, unknown>>
  /** Errors collected during the run. When an error carries a `values`
   *  snapshot, it is used as a fallback row payload so the report still
   *  shows the offending cells when the caller has no `rows[]` array
   *  (the post-job download path is in this situation). */
  errors: Array<{
    row: number
    field: string
    message: string
    values?: Record<string, unknown>
  }>
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Parwest ERP"
  wb.created = new Date()
  const ws = wb.addWorksheet("Errors")

  // Group errors by row number (1-based, header is row 1, first data row is 2).
  // We also collect the first non-empty `values` snapshot we see for each row;
  // every error on a given row carries the same row data, so any one of them
  // is sufficient. This lets QA see *which* cell value to correct even when
  // the caller didn't supply a parallel `rows[]` (the job route doesn't —
  // it only has the persisted error list).
  const errorsByRow = new Map<number, string[]>()
  const valuesByRow = new Map<number, Record<string, unknown>>()
  for (const e of opts.errors) {
    const list = errorsByRow.get(e.row) ?? []
    list.push(`${e.field}: ${e.message}`)
    errorsByRow.set(e.row, list)
    if (e.values && !valuesByRow.has(e.row)) {
      valuesByRow.set(e.row, e.values)
    }
  }

  ws.columns = [
    ...opts.headers.map((h) => ({ header: h, key: h, width: Math.min(Math.max(h.length + 4, 14), 36) })),
    { header: "__error_reason", key: "__error_reason", width: 60 },
  ]

  const headerRow = ws.getRow(1)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB91C1C" } }
    cell.alignment = { vertical: "middle", horizontal: "center" }
  })

  // Only emit rows that actually had errors. Row indexes from `errors` are
  // file-1-based (header=1), so the corresponding entry in `rows` is row-2.
  // Prefer the caller-supplied parallel `rows[]` snapshot (most faithful to
  // the original file); fall back to the per-error `values` snapshot so the
  // report is never blank just because the caller didn't have the rows array.
  for (const [rowNumber, messages] of [...errorsByRow.entries()].sort((a, b) => a[0] - b[0])) {
    const dataIdx = rowNumber - 2
    const original = opts.rows[dataIdx] ?? valuesByRow.get(rowNumber) ?? {}
    ws.addRow({ ...original, __error_reason: messages.join("; ") })
  }

  const arr = await wb.xlsx.writeBuffer()
  return Buffer.from(arr as ArrayBuffer)
}

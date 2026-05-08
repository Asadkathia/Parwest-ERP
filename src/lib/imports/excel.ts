/**
 * Excel / CSV parsing + template generation for bulk imports.
 *
 * Uses `exceljs` (already a project dep) so we don't add another CSV/xlsx
 * library. The parser intentionally tolerates extra trailing blank rows
 * and strips whitespace from headers — Excel users are inconsistent.
 */

import ExcelJS from "exceljs"

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
      const value = cell.value
      let normalised: string | number | boolean | null
      if (value == null) normalised = null
      else if (typeof value === "object" && "text" in value && typeof (value as { text: unknown }).text === "string") {
        // Rich text / hyperlink cells
        normalised = (value as { text: string }).text.trim()
      } else if (value instanceof Date) {
        // ISO `YYYY-MM-DD` is the canonical date format we accept
        normalised = value.toISOString().slice(0, 10)
      } else if (typeof value === "number" || typeof value === "boolean") {
        normalised = value
      } else {
        normalised = String(value).trim()
      }
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
  /** Errors collected during the run. */
  errors: Array<{ row: number; field: string; message: string }>
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Parwest ERP"
  wb.created = new Date()
  const ws = wb.addWorksheet("Errors")

  // Group errors by row number (1-based, header is row 1, first data row is 2).
  const errorsByRow = new Map<number, string[]>()
  for (const e of opts.errors) {
    const list = errorsByRow.get(e.row) ?? []
    list.push(`${e.field}: ${e.message}`)
    errorsByRow.set(e.row, list)
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
  for (const [rowNumber, messages] of [...errorsByRow.entries()].sort((a, b) => a[0] - b[0])) {
    const dataIdx = rowNumber - 2
    const original = opts.rows[dataIdx] ?? {}
    ws.addRow({ ...original, __error_reason: messages.join("; ") })
  }

  const arr = await wb.xlsx.writeBuffer()
  return Buffer.from(arr as ArrayBuffer)
}

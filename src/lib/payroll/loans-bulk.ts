export type BulkLoanDraftRow = {
  id: string
  guardId: string
  guardName: string
  amount: number
  loanDate: string
  notes: string
  status: "DRAFT" | "READY" | "COMMITTED" | "ERROR"
  error?: string
}

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/[\s_-]/g, "")
}

function resolveColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeader)
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate)
    if (idx !== -1) return idx
  }
  return -1
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

export function parseCsvToLoanRows(csvText: string): BulkLoanDraftRow[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0])

  const colGuardId = resolveColumn(headers, ["guardid", "parwestid", "id"])
  const colAmount = resolveColumn(headers, ["amount", "loanamount"])
  const colDate = resolveColumn(headers, ["loandate", "date", "month"])
  const colNotes = resolveColumn(headers, ["notes", "note", "remarks", "comment"])
  const colName = resolveColumn(headers, ["guardname", "name", "guard"])

  const today = new Date().toISOString().slice(0, 10)
  const rows: BulkLoanDraftRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    const id = `loan-bulk-${Date.now()}-${i}`

    const guardId = colGuardId !== -1 ? cells[colGuardId]?.trim() ?? "" : ""
    const amountRaw = colAmount !== -1 ? cells[colAmount]?.trim() ?? "" : ""
    const amount = amountRaw ? Number(amountRaw.replace(/[^0-9.]/g, "")) : 0
    const loanDate = colDate !== -1 ? cells[colDate]?.trim() || today : today
    const notes = colNotes !== -1 ? cells[colNotes]?.trim() ?? "" : ""
    const guardName = colName !== -1 ? cells[colName]?.trim() ?? "" : guardId

    const hasError = !guardId || Number.isNaN(amount) || amount <= 0
    rows.push({
      id,
      guardId,
      guardName,
      amount: Number.isNaN(amount) ? 0 : amount,
      loanDate,
      notes,
      status: hasError ? "ERROR" : "READY",
      error: !guardId
        ? "Missing guard ID"
        : Number.isNaN(amount) || amount <= 0
          ? "Invalid amount"
          : undefined,
    })
  }

  return rows
}

export function createDraftRowsFromUpload(fileName: string): BulkLoanDraftRow[] {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  return [
    {
      id: `loan-upload-${now.getTime()}`,
      guardId: "",
      guardName: fileName.replace(/\.[^.]+$/, "") || "Uploaded Row",
      amount: 0,
      loanDate: today,
      notes: "",
      status: "DRAFT",
    },
  ]
}

import ExcelJS from "exceljs"
import type { ReportColumn, ReportResultRow } from "../types"

export async function formatCsv(
  columns: ReportColumn[],
  rows: ReportResultRow[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Report")
  ws.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: c.width ?? 20,
  }))
  rows.forEach((r) => ws.addRow(r))
  const out = await wb.csv.writeBuffer()
  return Buffer.from(out as ArrayBuffer)
}

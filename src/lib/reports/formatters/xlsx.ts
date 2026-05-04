import ExcelJS from "exceljs"
import type { ReportColumn, ReportResultRow } from "../types"

export async function formatXlsx(
  title: string,
  columns: ReportColumn[],
  rows: ReportResultRow[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Parwest ERP"
  wb.created = new Date()
  const ws = wb.addWorksheet((title || "Report").slice(0, 31))
  ws.columns = columns.map((c) => {
    const numFmt =
      c.type === "currency"
        ? '"PKR" #,##0.00'
        : c.type === "number"
        ? "#,##0"
        : c.type === "date"
        ? "yyyy-mm-dd"
        : undefined
    return {
      header: c.label,
      key: c.key,
      width: c.width ?? 20,
      style: numFmt ? { numFmt } : undefined,
    }
  })
  ws.getRow(1).font = { bold: true }
  rows.forEach((r) => ws.addRow(r))
  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out as ArrayBuffer)
}

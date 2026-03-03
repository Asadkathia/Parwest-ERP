import { NextResponse } from "next/server"

export type ReportFormat = "json" | "csv"

export function parseReportFormat(value: string | null): ReportFormat {
  return value === "csv" ? "csv" : "json"
}

export function parseDateParam(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export function parseMonthRange(value: string | null): { start: Date; end: Date } | null {
  if (!value) return null
  const start = new Date(`${value}-01T00:00:00.000Z`)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
  return { start, end }
}

function csvEscape(value: unknown): string {
  if (value == null) return ""
  const normalized = String(value).replaceAll("\r\n", "\n").replaceAll("\r", "\n")
  if (normalized.includes(",") || normalized.includes("\"") || normalized.includes("\n")) {
    return `"${normalized.replaceAll("\"", "\"\"")}"`
  }
  return normalized
}

export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: Array<{ key: keyof T; label: string }>
): string {
  const header = columns.map((column) => csvEscape(column.label)).join(",")
  const body = rows.map((row) => columns.map((column) => csvEscape(row[column.key])).join(",")).join("\n")
  return `${header}\n${body}`
}

export function csvDownload(filename: string, csv: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

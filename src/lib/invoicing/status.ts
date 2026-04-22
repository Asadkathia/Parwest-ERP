import type { InvoiceStatus } from "@prisma/client"

export const INVOICE_STATUSES: InvoiceStatus[] = [
  "DRAFT",
  "PENDING",
  "ADVANCE_PAID",
  "PARTIAL_PAID",
  "PAID",
  "UNPAID",
  "OVERDUE",
  "VOID",
]

const STATUS_SET = new Set<string>(INVOICE_STATUSES)

export function parseInvoiceStatus(value: unknown): InvoiceStatus | null {
  if (typeof value !== "string") return null
  const upper = value.toUpperCase()
  return STATUS_SET.has(upper) ? (upper as InvoiceStatus) : null
}

export function isVoided(status: InvoiceStatus) {
  return status === "VOID"
}

export type LineItemKind = "GUARD_SALARY" | "SPECIAL_DUTY" | "MANUAL"

export type ComposerLineItem = {
  id: string
  kind: LineItemKind
  refId: string | null
  description: string
  quantity: number
  unitPrice: number
  rateSource?: "DEPLOYMENT" | "CONTRACT" | "NONE"
}

export type InvoiceLineItemDTO = {
  id: string
  kind: LineItemKind
  refId: string | null
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type InvoiceRow = {
  id: string
  invoiceNumber: string
  month: string
  amount: number
  subtotal: number
  taxRate: number | null
  taxAmount: number
  paidAmount: number
  status: string
  notes?: string | null
  branchId?: string | null
  branch?: { id: string; name: string } | null
  client?: { id: string; name: string }
  dueDate?: string | null
  voidedAt?: string | null
  voidReason?: string | null
  lineItems?: InvoiceLineItemDTO[]
  advanceApplications?: {
    id: string
    amount: number
    advance: { id: string; paymentDate: string; amount: number }
  }[]
}

export type AutofillItem = {
  kind: "GUARD_SALARY" | "SPECIAL_DUTY"
  refId: string
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
  rateSource?: "DEPLOYMENT" | "CONTRACT" | "NONE"
}

export type AdvanceRow = {
  id: string
  amount: number
  appliedAmount: number
  paymentDate: string
  method?: string | null
  reference?: string | null
  notes?: string | null
  branch?: { id: string; name: string } | null
  applications?: {
    id: string
    amount: number
    invoice: { id: string; invoiceNumber: string; month: string }
  }[]
}

export const STATUS_OPTIONS = [
  "DRAFT", "PENDING", "ADVANCE_PAID", "PARTIAL_PAID", "PAID", "UNPAID", "OVERDUE", "VOID",
] as const

export type ChipVariant = "neutral" | "success" | "warning" | "danger"

export function statusVariant(status: string): ChipVariant {
  switch (status) {
    case "PAID":
    case "ADVANCE_PAID":
      return "success"
    case "OVERDUE":
    case "UNPAID":
    case "VOID":
      return "danger"
    case "PARTIAL_PAID":
    case "PENDING":
      return "warning"
    default:
      return "neutral"
  }
}

export function round2(v: number) {
  return Math.round(v * 100) / 100
}

export function newItemId() {
  return `tmp_${Math.random().toString(36).slice(2, 10)}`
}

export function currentMonth(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

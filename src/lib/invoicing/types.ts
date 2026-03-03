export type InvoiceMode = "CLIENT_WISE" | "BRANCH_WISE"

export type InvoiceLine = {
  id: string
  label: string
  units: number
  rate: number
  amount: number
}

export type InvoiceDraft = {
  id: string
  mode: InvoiceMode
  clientId: string
  branchId: string | null
  period: string
  status: "DRAFT" | "POSTED"
  lines: InvoiceLine[]
  subtotal: number
  tax: number
  total: number
}

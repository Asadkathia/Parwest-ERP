import { mockClientsList } from "@/lib/mockData/clients"
import { mockDeploymentsList } from "@/lib/mockData/deployments"

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

function buildLines(mode: InvoiceMode, clientName: string, branchName: string | null): InvoiceLine[] {
  const baseUnits = mode === "CLIENT_WISE" ? 30 : 15
  return [
    { id: "line-1", label: `${clientName}${branchName ? ` - ${branchName}` : ""} Security Service`, units: baseUnits, rate: 8500, amount: baseUnits * 8500 },
    { id: "line-2", label: "Supervision Allowance", units: 1, rate: 25000, amount: 25000 },
  ]
}

export function getMockInvoiceDrafts(): InvoiceDraft[] {
  return mockClientsList.slice(0, 2).map((client, idx) => {
    const dep = mockDeploymentsList[idx]
    const mode: InvoiceMode = idx % 2 === 0 ? "CLIENT_WISE" : "BRANCH_WISE"
    const lines = buildLines(mode, client.name, mode === "BRANCH_WISE" ? dep?.branchId || null : null)
    const subtotal = lines.reduce((sum, line) => sum + line.amount, 0)
    const tax = Math.round(subtotal * 0.16)

    return {
      id: `inv-${idx + 1}`,
      mode,
      clientId: client.id,
      branchId: mode === "BRANCH_WISE" ? dep?.id || null : null,
      period: "2026-02",
      status: idx === 0 ? "DRAFT" : "POSTED",
      lines,
      subtotal,
      tax,
      total: subtotal + tax,
    }
  })
}

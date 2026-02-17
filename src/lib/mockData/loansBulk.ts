export type BulkLoanDraftRow = {
  id: string
  guardId: string
  guardName: string
  amount: number
  loanDate: string
  notes: string
  status: "DRAFT" | "READY" | "COMMITTED"
}

export const mockBulkLoanDraftRows: BulkLoanDraftRow[] = [
  {
    id: "loan-d-1",
    guardId: "PW-00001",
    guardName: "Test Guard One",
    amount: 12000,
    loanDate: "2026-02-10",
    notes: "Medical emergency",
    status: "READY",
  },
  {
    id: "loan-d-2",
    guardId: "PW-00002",
    guardName: "Test Guard Two",
    amount: 8000,
    loanDate: "2026-02-11",
    notes: "Family support",
    status: "DRAFT",
  },
]

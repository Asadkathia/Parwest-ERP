export type BulkLoanDraftRow = {
  id: string
  guardId: string
  guardName: string
  amount: number
  loanDate: string
  notes: string
  status: "DRAFT" | "READY" | "COMMITTED"
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

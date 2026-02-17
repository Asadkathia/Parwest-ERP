export type GuardPaymentMode = "BANK" | "CASH"
export type GuardCategory = "MUJAHID" | "REGULAR" | "EX_SERVICE" | "OTHER"

export type GuardBankAccount = {
  id: string
  bankName: string
  accountTitle: string
  accountNumber: string
  iban: string
  accountType: "SAVINGS" | "CURRENT"
  accountStatus: "ACTIVE" | "PENDING" | "INACTIVE"
  isActive: boolean
}

export type DocsChecklistItem = {
  guardId: string
  requiredDocs: string[]
  missingDocs: string[]
  printSelected: boolean
}

export type ClientEnrollmentMode = "BRANCHLESS" | "GROUP_WITH_BRANCHES"

export type SupervisorSwitchRequest = {
  regionId: string
  regionalOfficeId: string
  fromSupervisorId: string
  toSupervisorId: string
  reason: string
}

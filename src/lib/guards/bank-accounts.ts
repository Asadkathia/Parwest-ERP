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


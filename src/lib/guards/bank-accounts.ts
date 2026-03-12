export type GuardBankAccount = {
  id: string
  bankName: string
  accountTitle: string
  accountNumber: string
  iban: string
  branchCode: string
  accountType: "SAVINGS" | "CURRENT"
  accountStatus: "ACTIVE" | "PENDING" | "INACTIVE" | "DORMANT" | "SUSPENDED"
  walletType: "BANK" | "JAZZCASH" | "EASYPAISA" | "NAYAPAY" | "SADAPAY" | "UPAISA" | "OTHER"
  isActive: boolean
}


"use client"

import { useMemo, useState } from "react"
import type { GuardBankAccount } from "@/lib/guards/bank-accounts"

type AccountKind = "bank" | "wallet"

type Props = {
  name?: string
  defaultValue?: GuardBankAccount[]
}

const WALLET_TYPES = [
  { value: "JAZZCASH", label: "JazzCash" },
  { value: "EASYPAISA", label: "EasyPaisa" },
  { value: "NAYAPAY", label: "NayaPay" },
  { value: "SADAPAY", label: "SadaPay" },
  { value: "UPAISA", label: "UPaisa" },
  { value: "OTHER", label: "Other Wallet" },
]

const emptyAccount = (): GuardBankAccount => ({
  id: `acc-${crypto.randomUUID()}`,
  bankName: "",
  accountTitle: "",
  accountNumber: "",
  iban: "",
  branchCode: "",
  accountType: "SAVINGS",
  accountStatus: "ACTIVE",
  walletType: "BANK",
  isActive: false,
})

function getKind(account: GuardBankAccount): AccountKind {
  return account.walletType === "BANK" ? "bank" : "wallet"
}

export default function GuardAccountsEditor({ name = "bankAccounts", defaultValue }: Props) {
  const [accounts, setAccounts] = useState<GuardBankAccount[]>(
    defaultValue && defaultValue.length > 0 ? defaultValue : [{ ...emptyAccount(), isActive: true }]
  )

  const activeId = useMemo(() => accounts.find((a) => a.isActive)?.id || "", [accounts])

  const addAccount = () => {
    setAccounts((prev) => [...prev, emptyAccount()])
  }

  const removeAccount = (id: string) => {
    setAccounts((prev) => {
      const next = prev.filter((item) => item.id !== id)
      if (next.length === 0) return [{ ...emptyAccount(), isActive: true }]
      if (!next.some((item) => item.isActive)) next[0] = { ...next[0], isActive: true }
      return next
    })
  }

  const update = (id: string, patch: Partial<GuardBankAccount>) => {
    setAccounts((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const setActive = (id: string) => {
    setAccounts((prev) => prev.map((item) => ({ ...item, isActive: item.id === id })))
  }

  const setKind = (id: string, kind: AccountKind) => {
    if (kind === "bank") {
      update(id, { walletType: "BANK" })
    } else {
      update(id, { walletType: "JAZZCASH", iban: "", branchCode: "", accountType: "SAVINGS" })
    }
  }

  return (
    <section className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(accounts)} />
      <input type="hidden" name="activeBankAccountId" value={activeId} />

      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--text)]">Multiple Guard Accounts</h3>
        <button type="button" onClick={addAccount} className="ui-btn ui-btn-secondary px-3 py-1.5 text-sm">
          Add Account
        </button>
      </div>

      <div className="space-y-3">
        {accounts.map((account, index) => {
          const kind = getKind(account)
          return (
            <div key={account.id} className="rounded-[var(--radius-md)] border border-[var(--border)] p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--text)]">Account {index + 1}</p>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
                    <input
                      type="radio"
                      checked={account.isActive}
                      onChange={() => setActive(account.id)}
                      className="accent-[var(--brand)]"
                    />
                    Primary Account
                  </label>
                  <button
                    type="button"
                    onClick={() => removeAccount(account.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Bank Account / Digital Wallet Toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setKind(account.id, "bank")}
                  className={`px-4 py-1.5 rounded-[var(--radius-sm)] text-sm font-medium border transition-colors ${
                    kind === "bank"
                      ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                      : "bg-white text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--brand)] hover:text-[var(--text)]"
                  }`}
                >
                  Bank Account
                </button>
                <button
                  type="button"
                  onClick={() => setKind(account.id, "wallet")}
                  className={`px-4 py-1.5 rounded-[var(--radius-sm)] text-sm font-medium border transition-colors ${
                    kind === "wallet"
                      ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                      : "bg-white text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--brand)] hover:text-[var(--text)]"
                  }`}
                >
                  Digital Wallet
                </button>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Bank Name OR Wallet Type selector */}
                {kind === "bank" ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Bank Name</label>
                    <input
                      className="ui-input"
                      placeholder="e.g. HBL, MCB, UBL"
                      value={account.bankName}
                      onChange={(e) => update(account.id, { bankName: e.target.value })}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Wallet Type</label>
                    <select
                      className="ui-select"
                      value={account.walletType}
                      onChange={(e) =>
                        update(account.id, { walletType: e.target.value as GuardBankAccount["walletType"] })
                      }
                    >
                      {WALLET_TYPES.map((w) => (
                        <option key={w.value} value={w.value}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Account Title */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Account Title</label>
                  <input
                    className="ui-input"
                    placeholder="Account title (guard's full name)"
                    value={account.accountTitle}
                    onChange={(e) => update(account.id, { accountTitle: e.target.value })}
                  />
                </div>

                {/* Account Number */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Account Number *</label>
                  <input
                    className="ui-input"
                    placeholder="Account number"
                    value={account.accountNumber}
                    onChange={(e) => update(account.id, { accountNumber: e.target.value })}
                  />
                </div>

                {/* Bank-only fields */}
                {kind === "bank" && (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">IBAN</label>
                      <input
                        className="ui-input"
                        placeholder="e.g. PK00XXXX0000000000000000"
                        value={account.iban}
                        onChange={(e) => update(account.id, { iban: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Branch Code</label>
                      <input
                        className="ui-input"
                        placeholder="Branch code"
                        value={account.branchCode}
                        onChange={(e) => update(account.id, { branchCode: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Account Type</label>
                      <select
                        className="ui-select"
                        value={account.accountType}
                        onChange={(e) =>
                          update(account.id, { accountType: e.target.value as GuardBankAccount["accountType"] })
                        }
                      >
                        <option value="SAVINGS">Savings</option>
                        <option value="CURRENT">Current</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Account Status — always shown */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Account Status</label>
                  <select
                    className="ui-select"
                    value={account.accountStatus}
                    onChange={(e) =>
                      update(account.id, { accountStatus: e.target.value as GuardBankAccount["accountStatus"] })
                    }
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="DORMANT">Dormant</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

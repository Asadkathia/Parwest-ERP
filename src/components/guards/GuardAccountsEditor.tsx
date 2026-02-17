"use client"

import { useMemo, useState } from "react"
import type { GuardBankAccount } from "@/lib/mockData/meetingAdditions"

type Props = {
  name?: string
  defaultValue?: GuardBankAccount[]
}

const emptyAccount = (): GuardBankAccount => ({
  id: `acc-${crypto.randomUUID()}`,
  bankName: "",
  accountTitle: "",
  accountNumber: "",
  iban: "",
  accountType: "SAVINGS",
  accountStatus: "PENDING",
  isActive: false,
})

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

  return (
    <section className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(accounts)} />
      <input type="hidden" name="activeBankAccountId" value={activeId} />

      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--text)]">Multiple Guard Accounts</h3>
        <button type="button" onClick={addAccount} className="ui-btn ui-btn-secondary px-3 py-1.5 text-sm">Add Account</button>
      </div>

      <div className="space-y-3">
        {accounts.map((account, index) => (
          <div key={account.id} className="rounded-[var(--radius-md)] border border-[var(--border)] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--text)]">Account {index + 1}</p>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <input type="radio" checked={account.isActive} onChange={() => setActive(account.id)} />
                  Active
                </label>
                <button type="button" onClick={() => removeAccount(account.id)} className="text-xs text-red-600 hover:underline">Remove</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className="ui-input" placeholder="Bank name" value={account.bankName} onChange={(e) => update(account.id, { bankName: e.target.value })} />
              <input className="ui-input" placeholder="Account title" value={account.accountTitle} onChange={(e) => update(account.id, { accountTitle: e.target.value })} />
              <input className="ui-input" placeholder="Account number" value={account.accountNumber} onChange={(e) => update(account.id, { accountNumber: e.target.value })} />
              <input className="ui-input" placeholder="IBAN" value={account.iban} onChange={(e) => update(account.id, { iban: e.target.value })} />
              <select className="ui-select" value={account.accountType} onChange={(e) => update(account.id, { accountType: e.target.value as GuardBankAccount["accountType"] })}>
                <option value="SAVINGS">Savings</option>
                <option value="CURRENT">Current</option>
              </select>
              <select className="ui-select" value={account.accountStatus} onChange={(e) => update(account.id, { accountStatus: e.target.value as GuardBankAccount["accountStatus"] })}>
                <option value="PENDING">Pending</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

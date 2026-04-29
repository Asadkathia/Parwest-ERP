"use client"

import { useEffect, useState } from "react"
import { useFieldArray, useWatch, type Control, type FieldPath, type FieldValues } from "react-hook-form"
import type { BankAccountInput } from "@/lib/schemas/guard-edit"

type AccountKind = "bank" | "wallet"

const FALLBACK_BANK_NAMES = ["HBL", "MCB", "UBL", "Allied Bank", "Bank Alfalah", "Meezan Bank", "National Bank"]
const FALLBACK_WALLET_TYPES = [
  { value: "JazzCash", label: "JazzCash" },
  { value: "EasyPaisa", label: "EasyPaisa" },
  { value: "NayaPay", label: "NayaPay" },
  { value: "SadaPay", label: "SadaPay" },
  { value: "UPaisa", label: "UPaisa" },
]

export const emptyBankAccount = (): BankAccountInput => ({
  id: `acc-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`,
  bankName: "",
  accountTitle: "",
  accountNumber: "",
  iban: "",
  branchCode: "",
  branchLocation: "",
  accountType: "SAVINGS",
  accountStatus: "ACTIVE",
  walletType: "BANK",
  isActive: false,
})

function getKind(walletType: BankAccountInput["walletType"]): AccountKind {
  return walletType === "BANK" ? "bank" : "wallet"
}

// --- Stable, module-scope row sub-components ---
// These are defined OUTSIDE the parent component so React preserves their
// identity across re-renders. Re-defining components inline (or using inline
// ternaries that swap subtrees with mismatched structure) causes inputs to
// remount on every keystroke, which is what was making the Account Details
// fields lose focus after typing a single character.

type SelectorProps = {
  account: BankAccountInput
  bankNames: string[]
  walletTypes: { value: string; label: string }[]
  onUpdate: (patch: Partial<BankAccountInput>) => void
}

function BankNameSelector({ account, bankNames, onUpdate }: SelectorProps) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
        Bank Name <span className="text-red-500">*</span>
      </label>
      <select
        className="ui-select"
        value={account.bankName || ""}
        onChange={(e) => onUpdate({ bankName: e.target.value })}
      >
        <option value="">-- Select Bank --</option>
        {bankNames.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
    </div>
  )
}

function WalletTypeSelector({ account, walletTypes, onUpdate }: SelectorProps) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
        Wallet Type <span className="text-red-500">*</span>
      </label>
      <select
        className="ui-select"
        value={account.walletType || ""}
        onChange={(e) =>
          onUpdate({ walletType: e.target.value as BankAccountInput["walletType"] })
        }
      >
        <option value="">-- Select Wallet --</option>
        {walletTypes.map((w) => (
          <option key={w.value} value={w.value}>{w.label}</option>
        ))}
      </select>
    </div>
  )
}

function BankOnlyFields({
  account,
  onUpdate,
}: {
  account: BankAccountInput
  onUpdate: (patch: Partial<BankAccountInput>) => void
}) {
  return (
    <>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">IBAN</label>
        <input
          className="ui-input"
          placeholder="e.g. PK00XXXX0000000000000000"
          value={account.iban || ""}
          onChange={(e) => onUpdate({ iban: e.target.value })}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Branch Code</label>
        <input
          className="ui-input"
          placeholder="Branch code"
          value={account.branchCode || ""}
          onChange={(e) => onUpdate({ branchCode: e.target.value })}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
          Branch Location <span className="text-red-500">*</span>
        </label>
        <input
          className="ui-input"
          placeholder="e.g. Main Branch, Lahore"
          value={account.branchLocation || ""}
          onChange={(e) => onUpdate({ branchLocation: e.target.value })}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Account Type</label>
        <select
          className="ui-select"
          value={account.accountType || "SAVINGS"}
          onChange={(e) =>
            onUpdate({ accountType: e.target.value as BankAccountInput["accountType"] })
          }
        >
          <option value="SAVINGS">Savings</option>
          <option value="CURRENT">Current</option>
        </select>
      </div>
    </>
  )
}

// Loose generic over parent FieldValues — the parent form must include a
// `bankAccounts` field of type `BankAccountInput[]`, but TS can't statically
// enforce that constraint without breaking variance against zod's
// input-vs-transformed types (see `.default([])` in guardEditSchema). We
// cast internally; the contract is documented and load-bearing.
type Props<TForm extends FieldValues> = {
  control: Control<TForm>
  name?: FieldPath<TForm>
}

export default function GuardAccountsEditor<TForm extends FieldValues>({
  control,
  name,
}: Props<TForm>) {
  const fieldName = (name ?? "bankAccounts") as FieldPath<TForm>
  // useFieldArray with a generic Control isn't perfectly type-safe across
  // parent shapes; cast to the local `bankAccounts` shape since the contract
  // (FormShape) guarantees the field exists with the right element type.
  const { fields, append, remove, update } = useFieldArray({
    control: control as unknown as Control<{ bankAccounts: BankAccountInput[] }>,
    name: "bankAccounts",
  })

  // Watch the array so derived UI (e.g. Bank vs Wallet toggle, primary radio)
  // re-renders on edits.
  const watched = (useWatch({ control, name: fieldName }) as BankAccountInput[] | undefined) ?? []

  const [bankNames, setBankNames] = useState<string[]>(FALLBACK_BANK_NAMES)
  const [walletTypes, setWalletTypes] = useState<{ value: string; label: string }[]>(FALLBACK_WALLET_TYPES)

  useEffect(() => {
    fetch("/api/guard-bank-names?activeOnly=true")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Array<{ name: string }>) => { if (data.length > 0) setBankNames(data.map((d) => d.name)) })
      .catch(() => {})
    fetch("/api/guard-wallet-types?activeOnly=true")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Array<{ name: string }>) => { if (data.length > 0) setWalletTypes(data.map((d) => ({ value: d.name, label: d.name }))) })
      .catch(() => {})
  }, [])

  // Ensure at least one row exists with isActive=true on first render.
  useEffect(() => {
    if (fields.length === 0) {
      append({ ...emptyBankAccount(), isActive: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addAccount = () => {
    append(emptyBankAccount())
  }

  const removeAccount = (index: number) => {
    if (fields.length <= 1) {
      // Don't drop the last row — reset it instead so the form always has
      // at least one (matching legacy behavior).
      update(0, { ...emptyBankAccount(), isActive: true })
      return
    }
    const wasActive = watched[index]?.isActive
    remove(index)
    if (wasActive) {
      // Shift active flag onto the new first row.
      const remaining = watched.filter((_, i) => i !== index)
      if (remaining.length > 0) {
        update(0, { ...remaining[0], isActive: true })
      }
    }
  }

  const setActive = (index: number) => {
    watched.forEach((row, i) => {
      update(i, { ...row, isActive: i === index })
    })
  }

  const setKind = (index: number, kind: AccountKind) => {
    const current = watched[index]
    if (!current) return
    if (kind === "bank") {
      update(index, { ...current, walletType: "BANK" })
    } else {
      update(index, {
        ...current,
        walletType: "JAZZCASH",
        iban: "",
        branchCode: "",
        accountType: "SAVINGS",
      })
    }
  }

  const updateField = (index: number, patch: Partial<BankAccountInput>) => {
    const current = watched[index]
    if (!current) return
    update(index, { ...current, ...patch })
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--text)]">Multiple Guard Accounts</h3>
        <button type="button" onClick={addAccount} className="ui-btn ui-btn-secondary px-3 py-1.5 text-sm">
          Add Account
        </button>
      </div>

      <div className="space-y-3">
        {fields.map((field, index) => {
          const account = watched[index] ?? (field as unknown as BankAccountInput)
          const kind = getKind(account.walletType)
          return (
            <div key={field.id} className="rounded-[var(--radius-md)] border border-[var(--border)] p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--text)]">Account {index + 1}</p>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
                    <input
                      type="radio"
                      checked={Boolean(account.isActive)}
                      onChange={() => setActive(index)}
                      className="accent-[var(--brand)]"
                    />
                    Primary Account
                  </label>
                  <button
                    type="button"
                    onClick={() => removeAccount(index)}
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
                  onClick={() => setKind(index, "bank")}
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
                  onClick={() => setKind(index, "wallet")}
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
                  <BankNameSelector
                    account={account}
                    bankNames={bankNames}
                    walletTypes={walletTypes}
                    onUpdate={(patch) => updateField(index, patch)}
                  />
                ) : (
                  <WalletTypeSelector
                    account={account}
                    bankNames={bankNames}
                    walletTypes={walletTypes}
                    onUpdate={(patch) => updateField(index, patch)}
                  />
                )}

                {/* Account Title */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Account Title</label>
                  <input
                    className="ui-input"
                    placeholder="Account title (guard's full name)"
                    value={account.accountTitle || ""}
                    onChange={(e) => updateField(index, { accountTitle: e.target.value })}
                  />
                </div>

                {/* Account Number */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                    Account Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="ui-input"
                    placeholder="Account number"
                    value={account.accountNumber || ""}
                    onChange={(e) => updateField(index, { accountNumber: e.target.value })}
                  />
                </div>

                {/* Bank-only fields */}
                {kind === "bank" && (
                  <BankOnlyFields
                    account={account}
                    onUpdate={(patch) => updateField(index, patch)}
                  />
                )}

                {/* Account Status — always shown */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Account Status</label>
                  <select
                    className="ui-select"
                    value={account.accountStatus || "ACTIVE"}
                    onChange={(e) =>
                      updateField(index, { accountStatus: e.target.value as BankAccountInput["accountStatus"] })
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

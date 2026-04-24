"use client"

import { useState } from "react"
import { CreditCard, Plus, Eye, EyeOff } from "lucide-react"
import type { GuardLooseRow } from "@/components/guards/tabs/types"

type BankAccount = {
    bankName?: string | null
    accountNumber?: string | null
    accountType?: string | null
    iban?: string | null
    branchCode?: string | null
    walletType?: string | null
    isActive?: boolean
}

type BankDetails = {
    bankName?: string | null
    accountNumber?: string | null
    accountType?: string | null
    iban?: string | null
    branchCode?: string | null
    bankAccountsJson?: string | null
}

interface BankDetailsTabProps {
    bankDetails: GuardLooseRow | null | undefined
    guardId: string
    canUpdate?: boolean
}

function mask(value: string | null | undefined, visible: boolean): string {
    if (!value) return "—"
    if (visible) return value
    // Show last 4 chars, mask the rest
    if (value.length <= 4) return "••••"
    return "•".repeat(value.length - 4) + value.slice(-4)
}

function maskFull(value: string | null | undefined, visible: boolean): string {
    if (!value) return "—"
    if (visible) return value
    return "•".repeat(value.length)
}

function AccountCard({ account, index, isActive, visible }: { account: BankAccount; index: number; isActive?: boolean; visible: boolean }) {
    const isWallet = account.walletType && account.walletType !== "BANK"
    return (
        <div className={`rounded-[var(--radius-md)] border p-5 space-y-4 ${isActive ? "border-[var(--brand)] bg-blue-50/40" : "border-[var(--border)]"}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-[var(--text)]">Account {index + 1}</h4>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isWallet ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                        {isWallet ? "Digital Wallet" : "Bank Account"}
                    </span>
                </div>
                {isActive && (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Primary</span>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isWallet ? (
                    <>
                        <div>
                            <p className="text-xs text-[var(--text-muted)]">Wallet Type</p>
                            <p className="font-medium text-[var(--text)] mt-0.5">{account.walletType}</p>
                        </div>
                        <div>
                            <p className="text-xs text-[var(--text-muted)]">Account Number / Phone</p>
                            <p className="font-medium font-mono text-[var(--text)] mt-0.5">{mask(account.accountNumber, visible)}</p>
                        </div>
                    </>
                ) : (
                    <>
                        <div>
                            <p className="text-xs text-[var(--text-muted)]">Bank Name</p>
                            <p className="font-medium text-[var(--text)] mt-0.5">{account.bankName || "—"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-[var(--text-muted)]">Account Number</p>
                            <p className="font-medium font-mono text-[var(--text)] mt-0.5">{mask(account.accountNumber, visible)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-[var(--text-muted)]">Account Type</p>
                            <p className="font-medium text-[var(--text)] mt-0.5">{account.accountType || "—"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-[var(--text-muted)]">Branch Code</p>
                            <p className="font-medium font-mono text-[var(--text)] mt-0.5">{maskFull(account.branchCode, visible)}</p>
                        </div>
                        {account.iban && (
                            <div className="md:col-span-2">
                                <p className="text-xs text-[var(--text-muted)]">IBAN</p>
                                <p className="font-medium font-mono text-[var(--text)] mt-0.5">{mask(account.iban, visible)}</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

export default function BankDetailsTab({ bankDetails, guardId, canUpdate = false }: BankDetailsTabProps) {
    const [visible, setVisible] = useState(false)
    const details = (bankDetails || {}) as BankDetails

    // Parse multiple accounts from bankAccountsJson if available
    let accounts: BankAccount[] = []
    if (details.bankAccountsJson) {
        try {
            const parsed = JSON.parse(details.bankAccountsJson)
            if (Array.isArray(parsed)) {
                // Filter out empty placeholder accounts (no meaningful data filled in)
                accounts = parsed.filter((a: BankAccount) =>
                    a.bankName || a.accountNumber || a.iban ||
                    (a.walletType && a.walletType !== "BANK")
                )
            }
        } catch { /* ignore */ }
    }

    // Fall back to primary flat fields if no JSON accounts
    const hasPrimaryFlat = details.bankName || details.accountNumber || details.iban || details.branchCode

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-[var(--text)]">Bank Details</h2>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setVisible((v) => !v)}
                        className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
                        title={visible ? "Hide sensitive details" : "Show sensitive details"}
                    >
                        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {visible ? "Hide" : "Show"} Details
                    </button>
                    {canUpdate && (
                        <a
                            href={`/guards/${guardId}/edit?tab=bank`}
                            className="flex items-center gap-2 rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                        >
                            <Plus className="h-4 w-4" />
                            Update Details
                        </a>
                    )}
                </div>
            </div>

            {!visible && (accounts.length > 0 || hasPrimaryFlat) && (
                <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 px-4 py-2.5">
                    <EyeOff className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-800">Sensitive details are hidden. Click <strong>Show Details</strong> to reveal account numbers and IBAN.</p>
                </div>
            )}

            <div className="ui-card p-6 space-y-5">
                <h3 className="text-base font-semibold text-[var(--text)] flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-[var(--brand)]" />
                    Banking Information
                </h3>

                {accounts.length > 0 ? (
                    <div className="space-y-4">
                        {accounts.map((acc, i) => (
                            <AccountCard key={i} account={acc} index={i} isActive={acc.isActive ?? i === 0} visible={visible} />
                        ))}
                    </div>
                ) : hasPrimaryFlat ? (
                    <AccountCard
                        account={{
                            bankName: details.bankName,
                            accountNumber: details.accountNumber,
                            accountType: details.accountType,
                            iban: details.iban,
                            branchCode: details.branchCode,
                        }}
                        index={0}
                        isActive={true}
                        visible={visible}
                    />
                ) : (
                    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] px-6 py-10 text-center">
                        <CreditCard className="mx-auto h-8 w-8 text-[var(--text-muted)] mb-3" />
                        <p className="text-sm text-[var(--text-muted)]">No bank details recorded yet.</p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">Edit the guard profile to add banking information.</p>
                    </div>
                )}
            </div>

            <div className="rounded-[var(--radius-md)] border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Bank details are used for salary disbursement. Please ensure all information is accurate.
                </p>
            </div>
        </div>
    )
}

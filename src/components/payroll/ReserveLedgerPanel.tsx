"use client"

/**
 * Reserve Ledger panel for a single guard.
 *
 * Visual + table conventions cribbed from
 * `src/app/(dashboard)/payroll/loans/page.tsx` (table head bg
 * `var(--surface-muted)`, row borders `border-[var(--border)]`).
 */

import { useCallback, useEffect, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type LedgerEntry = {
  id: string
  type: "ACCRUED" | "RELEASED" | string
  amount: number | string
  reason: string | null
  byUserId: string | null
  byUserName: string | null
  paymentMethod: string | null
  slipNumber: string | null
  paidAt: string | null
  createdAt: string
}

type LedgerResponse = {
  guardId: string
  balance: number
  totalAccrued: number
  totalReleased: number
  entries: LedgerEntry[]
}

type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; message: string; code?: string }

type Props = {
  guardId: string
}

const PAYMENT_METHODS = ["BANK", "CASH", "MOBILE"] as const

function asNumber(v: number | string | null | undefined): number {
  if (typeof v === "number") return v
  if (typeof v === "string") {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export default function ReserveLedgerPanel({ guardId }: Props) {
  const [data, setData] = useState<LedgerResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    if (!guardId) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(
        `/api/payroll/reserve/ledger?guardId=${encodeURIComponent(guardId)}`
      )
      const json = (await res.json().catch(() => null)) as
        | ApiEnvelope<LedgerResponse>
        | null
      if (!json || !json.success) {
        setLoadError(json && !json.success ? json.message : `HTTP ${res.status}`)
        setData(null)
      } else {
        setData(json.data)
      }
    } catch (e) {
      setLoadError((e as Error).message ?? "Network error.")
    } finally {
      setLoading(false)
    }
  }, [guardId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <section className="ui-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Current Reserve Balance
            </div>
            <div className="text-3xl font-bold text-green-700 mt-1">
              {data ? data.balance.toLocaleString() : loading ? "…" : "0"}
            </div>
            {data && (
              <div className="text-xs text-[var(--text-muted)] mt-1">
                Accrued {data.totalAccrued.toLocaleString()} • Released{" "}
                {data.totalReleased.toLocaleString()}
              </div>
            )}
          </div>
          <ActionButton
            onClick={() => setOpen(true)}
            disabled={!data || data.balance <= 0}
          >
            Release Reserve
          </ActionButton>
        </div>
        {loadError && (
          <div className="mt-3">
            <InlineAlert type="error" message={loadError} />
          </div>
        )}
      </section>

      <section className="ui-card p-4">
        <h3 className="text-base font-semibold mb-3">Ledger Entries</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Reason</th>
                <th className="px-3 py-2 text-left">By</th>
                <th className="px-3 py-2 text-left">Slip / Method</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[var(--text-muted)]">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && data?.entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[var(--text-muted)]">
                    No reserve entries yet.
                  </td>
                </tr>
              )}
              {!loading &&
                data?.entries.map((e) => {
                  const amount = asNumber(e.amount)
                  return (
                    <tr key={e.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2 text-xs">
                        {e.createdAt.slice(0, 10)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`ui-chip ${
                            e.type === "ACCRUED"
                              ? "ui-chip-success"
                              : e.type === "RELEASED"
                                ? "ui-chip-warning"
                                : "ui-chip-neutral"
                          }`}
                        >
                          {e.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {amount.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">{e.reason ?? ""}</td>
                      <td className="px-3 py-2 text-xs">{e.byUserName ?? ""}</td>
                      <td className="px-3 py-2 text-xs">
                        {e.type === "RELEASED"
                          ? `${e.slipNumber ?? "—"} / ${e.paymentMethod ?? "—"}`
                          : ""}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </section>

      {open && data && (
        <ReleaseModal
          guardId={guardId}
          balance={data.balance}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function ReleaseModal({
  guardId,
  balance,
  onClose,
  onDone,
}: {
  guardId: string
  balance: number
  onClose: () => void
  onDone: () => void
}) {
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [slipNumber, setSlipNumber] = useState("")
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amountNum = Number(amount)
  const amountValid = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= balance
  const canSubmit =
    amountValid && reason.trim().length > 0 && paymentMethod && slipNumber.trim()

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/payroll/reserve/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardId,
          amount: amountNum,
          reason: reason.trim(),
          paymentMethod,
          slipNumber: slipNumber.trim(),
          paidAt: paidAt || undefined,
        }),
      })
      const json = (await res.json().catch(() => null)) as
        | ApiEnvelope<{ ledgerId: string; newBalance: number }>
        | null
      if (!json || !json.success) {
        setError(json && !json.success ? json.message : `HTTP ${res.status}`)
        setBusy(false)
        return
      }
      onDone()
    } catch (e) {
      setError((e as Error).message ?? "Network error.")
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="ui-card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Release Reserve</h2>
          <button
            type="button"
            className="text-2xl text-[var(--text-muted)] hover:text-[var(--text)]"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {error && <InlineAlert type="error" message={error} />}
        <div className="text-xs text-[var(--text-muted)]">
          Available balance:{" "}
          <span className="font-semibold text-[var(--text)]">
            {balance.toLocaleString()}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Amount *
            </label>
            <input
              type="number"
              className="ui-input w-full"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
            {amount && !amountValid && (
              <div className="text-xs text-red-500 mt-1">
                Amount must be &gt; 0 and ≤ available balance.
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Payment Method *
            </label>
            <select
              className="ui-select w-full"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="">Select…</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Slip Number *
            </label>
            <input
              className="ui-input w-full"
              value={slipNumber}
              onChange={(e) => setSlipNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Paid Date
            </label>
            <input
              type="date"
              className="ui-input w-full"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
            Reason *
          </label>
          <textarea
            className="ui-input min-h-[80px] w-full"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <ActionButton variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </ActionButton>
          <ActionButton onClick={submit} disabled={!canSubmit || busy}>
            {busy ? "Releasing…" : "Confirm Release"}
          </ActionButton>
        </div>
      </div>
    </div>
  )
}

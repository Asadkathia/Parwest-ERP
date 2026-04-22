"use client"

import { useState } from "react"
import ActionButton from "@/components/ui/action-button"
import PayrollPageShell from "@/components/payroll/shared/PayrollPageShell"
import GuardAutocomplete from "@/components/payroll/shared/GuardAutocomplete"
import GuardContextFields from "@/components/payroll/shared/GuardContextFields"
import type { GuardCurrentContext } from "@/lib/guards/currentContext"

type ClearanceStep = { step: string; ok: boolean; count?: number; message?: string }

export default function PayrollClearanceManager() {
  const [parwestIdInput, setParwestIdInput] = useState("")
  const [context, setContext] = useState<GuardCurrentContext | null>(null)
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [otherDeduction, setOtherDeduction] = useState("0")
  const [paymentDate, setPaymentDate] = useState("")
  const [slipNumber, setSlipNumber] = useState("")
  const [busy, setBusy] = useState(false)
  const [steps, setSteps] = useState<ClearanceStep[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGuardSelect = async (opt: { id: string; parwestId: string }) => {
    setParwestIdInput(opt.parwestId)
    setSteps(null)
    setError(null)
    const res = await fetch(`/api/guards/${opt.id}/current-context?month=${month}`)
    if (res.ok) setContext(await res.json())
  }

  const canSubmit = Boolean(context && month && paymentDate && slipNumber)

  const initiate = async () => {
    if (!context) return
    const confirmed = confirm(
      `Initiate clearance for ${context.name}?\n\nThis will:\n• Revoke active deployment\n• Return all inventory\n• Return all pledged documents\n• Mark guard INACTIVE\n\nThis cannot be undone.`
    )
    if (!confirmed) return

    setBusy(true)
    setError(null)
    setSteps(null)
    try {
      const res = await fetch("/api/payroll/clearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardId: context.guardId,
          month: `${month}-01`,
          otherDeduction: Number(otherDeduction) || 0,
          paymentDate,
          slipNumber,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSteps(data.steps)
      } else {
        setError(data.message ?? "Clearance failed.")
      }
    } catch {
      setError("Network error.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <PayrollPageShell
      title="Payroll — Clearance"
      subtitle="Reverse cycle for deployment: revoke deployment, return inventory, return pledged documents, finalize payroll."
    >
      <section className="ui-card p-4 space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
            Secure Ops ID *
          </label>
          <GuardAutocomplete
            value={parwestIdInput}
            onChange={setParwestIdInput}
            onSelect={handleGuardSelect}
          />
        </div>

        <GuardContextFields
          context={context}
          showRows={["name", "status", "type", "location", "loan"]}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Month *
            </label>
            <input
              type="month"
              className="ui-input"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Other Deduction
            </label>
            <input
              type="number"
              className="ui-input"
              value={otherDeduction}
              onChange={(e) => setOtherDeduction(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Payment Date *
            </label>
            <input
              type="date"
              className="ui-input"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
            Slip Number *
          </label>
          <input
            className="ui-input"
            value={slipNumber}
            onChange={(e) => setSlipNumber(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <ActionButton onClick={initiate} disabled={!canSubmit || busy}>
            {busy ? "Processing…" : "Initiate Clearance"}
          </ActionButton>
        </div>

        {error && <div className="text-sm text-red-500">{error}</div>}
      </section>

      {steps && (
        <section className="ui-card p-4 mt-6">
          <h3 className="text-base font-semibold mb-3">Clearance Steps</h3>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li
                key={i}
                className="flex items-center gap-3 px-3 py-2 rounded bg-green-50 border border-green-200"
              >
                <span className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs">
                  {i + 1}
                </span>
                <span className="font-medium">{s.step}</span>
                {s.count !== undefined && (
                  <span className="text-xs text-[var(--text-muted)]">
                    — {s.count} record(s) updated
                  </span>
                )}
                {s.message && (
                  <span className="text-xs text-[var(--text-muted)]">— {s.message}</span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </PayrollPageShell>
  )
}

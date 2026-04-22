"use client"

/**
 * Action buttons + modals for the Payroll state machine.
 *
 * Modal pattern reused from `src/components/payroll/PayrollOtherDeductionsManager.tsx`
 * (`fixed inset-0 z-50 ... ui-card max-w-* p-6`). Buttons are `ActionButton`
 * from `src/components/ui/action-button.tsx`. Errors come from the API
 * envelope's `data.message`.
 */

import { useState } from "react"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type Scope = {
  month: string // YYYY-MM
  regionId?: string
  regionalOfficeId?: string
}

type Props = {
  payrollId?: string
  scope?: Scope
  state: string
  isSuperAdmin: boolean
  onActionComplete: () => void
}

type ApiEnvelope<T = unknown> =
  | { success: true; data: T }
  | { success: false; message: string; code?: string }

const PAYMENT_METHODS = ["BANK", "CASH", "MOBILE"] as const

async function postJson<T = unknown>(
  url: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data: T | null; message: string | null }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
    if (!json) {
      return { ok: false, data: null, message: `HTTP ${res.status}` }
    }
    if (json.success) return { ok: true, data: json.data, message: null }
    return { ok: false, data: null, message: json.message ?? "Request failed." }
  } catch (e) {
    return {
      ok: false,
      data: null,
      message: (e as Error).message ?? "Network error.",
    }
  }
}

export default function PayrollStateActions({
  payrollId,
  scope,
  state,
  isSuperAdmin,
  onActionComplete,
}: Props) {
  const [open, setOpen] = useState<
    | null
    | "hold"
    | "release-hold"
    | "emergency"
    | "mark-paid"
    | "lock-region"
    | "unlock-region"
    | "global-finalize"
    | "global-unfinalize"
  >(null)

  // Per-row availability
  const canMarkPaid =
    !!payrollId &&
    (state === "REGIONAL_LOCKED" ||
      state === "GLOBAL_FINALIZED" ||
      state === "EMERGENCY_RELEASED")
  const canHold =
    !!payrollId &&
    state !== "PAID" &&
    state !== "HOLD" &&
    state !== "GLOBAL_FINALIZED"
  const canReleaseHold = !!payrollId && state === "HOLD"
  const canEmergencyRelease =
    !!payrollId && isSuperAdmin && state !== "PAID"

  // Bulk availability
  const canLockRegion = !!scope && state === "CALCULATED"
  const canUnlockRegion =
    !!scope && isSuperAdmin && state === "REGIONAL_LOCKED"
  const canGlobalFinalize =
    !!scope && isSuperAdmin && state === "REGIONAL_LOCKED"
  const canGlobalUnfinalize =
    !!scope && isSuperAdmin && state === "GLOBAL_FINALIZED"

  return (
    <div className="flex flex-wrap gap-2">
      {canLockRegion && (
        <ActionButton onClick={() => setOpen("lock-region")}>
          Lock Region
        </ActionButton>
      )}
      {canUnlockRegion && (
        <ActionButton variant="secondary" onClick={() => setOpen("unlock-region")}>
          Unlock Region
        </ActionButton>
      )}
      {canGlobalFinalize && (
        <ActionButton onClick={() => setOpen("global-finalize")}>
          Globally Finalize
        </ActionButton>
      )}
      {canGlobalUnfinalize && (
        <ActionButton variant="secondary" onClick={() => setOpen("global-unfinalize")}>
          Unfreeze Global
        </ActionButton>
      )}
      {canMarkPaid && (
        <ActionButton onClick={() => setOpen("mark-paid")}>Mark Paid</ActionButton>
      )}
      {canHold && (
        <ActionButton variant="secondary" onClick={() => setOpen("hold")}>
          Place Hold
        </ActionButton>
      )}
      {canReleaseHold && (
        <ActionButton onClick={() => setOpen("release-hold")}>
          Release Hold
        </ActionButton>
      )}
      {canEmergencyRelease && (
        <ActionButton variant="danger" onClick={() => setOpen("emergency")}>
          Emergency Release
        </ActionButton>
      )}

      {open === "hold" && payrollId && (
        <HoldModal
          payrollId={payrollId}
          onClose={() => setOpen(null)}
          onDone={() => {
            setOpen(null)
            onActionComplete()
          }}
        />
      )}
      {open === "release-hold" && payrollId && (
        <ReleaseHoldModal
          payrollId={payrollId}
          onClose={() => setOpen(null)}
          onDone={() => {
            setOpen(null)
            onActionComplete()
          }}
        />
      )}
      {open === "emergency" && payrollId && (
        <EmergencyReleaseModal
          payrollId={payrollId}
          onClose={() => setOpen(null)}
          onDone={() => {
            setOpen(null)
            onActionComplete()
          }}
        />
      )}
      {open === "mark-paid" && payrollId && (
        <MarkPaidModal
          payrollId={payrollId}
          onClose={() => setOpen(null)}
          onDone={() => {
            setOpen(null)
            onActionComplete()
          }}
        />
      )}
      {open === "lock-region" && scope && (
        <LockRegionModal
          scope={scope}
          onClose={() => setOpen(null)}
          onDone={() => {
            setOpen(null)
            onActionComplete()
          }}
        />
      )}
      {open === "unlock-region" && scope && (
        <UnlockRegionModal
          scope={scope}
          onClose={() => setOpen(null)}
          onDone={() => {
            setOpen(null)
            onActionComplete()
          }}
        />
      )}
      {open === "global-finalize" && scope && (
        <GlobalFinalizeModal
          scope={scope}
          onClose={() => setOpen(null)}
          onDone={() => {
            setOpen(null)
            onActionComplete()
          }}
        />
      )}
      {open === "global-unfinalize" && scope && (
        <GlobalUnfinalizeModal
          scope={scope}
          onClose={() => setOpen(null)}
          onDone={() => {
            setOpen(null)
            onActionComplete()
          }}
        />
      )}
    </div>
  )
}

// ───────────────────── Modal shell ─────────────────────

type ModalProps = {
  title: string
  onClose: () => void
  children: React.ReactNode
}

function ModalShell({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="ui-card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            className="text-2xl text-[var(--text-muted)] hover:text-[var(--text)]"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ───────────────────── Per-row modals ─────────────────────

function HoldModal({
  payrollId,
  onClose,
  onDone,
}: {
  payrollId: string
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (reason.trim().length < 5) {
      setError("Reason must be at least 5 characters.")
      return
    }
    setBusy(true)
    setError(null)
    const res = await postJson("/api/payroll/state/hold", {
      payrollId,
      reason: reason.trim(),
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.message ?? "Failed to place HOLD.")
      return
    }
    onDone()
  }

  return (
    <ModalShell title="Place Hold" onClose={onClose}>
      {error && <InlineAlert type="error" message={error} />}
      <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
        Reason (required, min 5 chars)
      </label>
      <textarea
        className="ui-input min-h-[100px] w-full"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why is this payroll being held?"
      />
      <div className="flex justify-end gap-2 pt-2">
        <ActionButton variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </ActionButton>
        <ActionButton onClick={submit} disabled={busy}>
          {busy ? "Placing…" : "Place Hold"}
        </ActionButton>
      </div>
    </ModalShell>
  )
}

function ReleaseHoldModal({
  payrollId,
  onClose,
  onDone,
}: {
  payrollId: string
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    const res = await postJson("/api/payroll/state/release-hold", {
      payrollId,
      reason: reason.trim() || undefined,
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.message ?? "Failed to release HOLD.")
      return
    }
    onDone()
  }

  return (
    <ModalShell title="Release Hold" onClose={onClose}>
      {error && <InlineAlert type="error" message={error} />}
      <p className="text-sm text-[var(--text-muted)]">
        Returns the payroll to its previous resting state.
      </p>
      <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
        Reason (optional)
      </label>
      <textarea
        className="ui-input min-h-[80px] w-full"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex justify-end gap-2 pt-2">
        <ActionButton variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </ActionButton>
        <ActionButton onClick={submit} disabled={busy}>
          {busy ? "Releasing…" : "Release"}
        </ActionButton>
      </div>
    </ModalShell>
  )
}

function EmergencyReleaseModal({
  payrollId,
  onClose,
  onDone,
}: {
  payrollId: string
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!reason.trim()) {
      setError("A reason is required.")
      return
    }
    setBusy(true)
    setError(null)
    const res = await postJson("/api/payroll/state/emergency-release", {
      payrollId,
      reason: reason.trim(),
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.message ?? "Failed.")
      return
    }
    onDone()
  }

  return (
    <ModalShell title="Emergency Release" onClose={onClose}>
      <InlineAlert
        type="error"
        message="This will bypass any locks. Audited."
      />
      {error && <InlineAlert type="error" message={error} />}
      <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
        Reason (required)
      </label>
      <textarea
        className="ui-input min-h-[100px] w-full"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex justify-end gap-2 pt-2">
        <ActionButton variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </ActionButton>
        <ActionButton variant="danger" onClick={submit} disabled={busy}>
          {busy ? "Releasing…" : "Confirm Emergency Release"}
        </ActionButton>
      </div>
    </ModalShell>
  )
}

function MarkPaidModal({
  payrollId,
  onClose,
  onDone,
}: {
  payrollId: string
  onClose: () => void
  onDone: () => void
}) {
  const [paymentMethod, setPaymentMethod] = useState("")
  const [paymentRemarks, setPaymentRemarks] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!paymentMethod) {
      setError("Payment method is required.")
      return
    }
    setBusy(true)
    setError(null)
    const res = await postJson("/api/payroll/state/mark-paid", {
      payrollId,
      paymentMethod,
      paymentRemarks: paymentRemarks.trim() || undefined,
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.message ?? "Failed.")
      return
    }
    onDone()
  }

  return (
    <ModalShell title="Mark Paid" onClose={onClose}>
      {error && <InlineAlert type="error" message={error} />}
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
      <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1 mt-2">
        Remarks
      </label>
      <textarea
        className="ui-input min-h-[80px] w-full"
        value={paymentRemarks}
        onChange={(e) => setPaymentRemarks(e.target.value)}
      />
      <div className="flex justify-end gap-2 pt-2">
        <ActionButton variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </ActionButton>
        <ActionButton onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Confirm"}
        </ActionButton>
      </div>
    </ModalShell>
  )
}

// ───────────────────── Bulk modals ─────────────────────

function LockRegionModal({
  scope,
  onClose,
  onDone,
}: {
  scope: Scope
  onClose: () => void
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Confirm modal — we don't pre-fetch a count to avoid an extra endpoint;
  // the backend short-circuits when nothing matches and returns a friendly
  // message. The success result populates a toast in the parent via onDone.

  const submit = async () => {
    setBusy(true)
    setError(null)
    const res = await postJson<{ locked: number; totalNet: number; totalReserve: number; historyId?: string | null }>(
      "/api/payroll/state/lock-region",
      {
        month: scope.month,
        regionId: scope.regionId,
        regionalOfficeId: scope.regionalOfficeId,
      }
    )
    setBusy(false)
    if (!res.ok) {
      setError(res.message ?? "Failed to lock.")
      return
    }
    onDone()
  }

  return (
    <ModalShell title="Lock Region" onClose={onClose}>
      {error && <InlineAlert type="error" message={error} />}
      <p className="text-sm text-[var(--text)]">
        This will lock all <span className="font-semibold">CALCULATED</span> payrolls
        for{" "}
        <span className="font-mono">{scope.month}</span>
        {scope.regionId ? ` in the selected region` : ` across your scope`} and
        accrue their reserve amounts to the ledger.
      </p>
      <p className="text-xs text-[var(--text-muted)]">
        After this, payrolls can be marked Paid or held; only a SuperAdmin can
        unlock the region.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <ActionButton variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </ActionButton>
        <ActionButton onClick={submit} disabled={busy}>
          {busy ? "Locking…" : "Confirm Lock"}
        </ActionButton>
      </div>
    </ModalShell>
  )
}

function UnlockRegionModal({
  scope,
  onClose,
  onDone,
}: {
  scope: Scope
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!scope.regionId) {
      setError("Region is required to unlock.")
      return
    }
    setBusy(true)
    setError(null)
    const res = await postJson("/api/payroll/state/unlock-region", {
      month: scope.month,
      regionId: scope.regionId,
      regionalOfficeId: scope.regionalOfficeId,
      reason: reason.trim() || undefined,
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.message ?? "Failed to unlock.")
      return
    }
    onDone()
  }

  return (
    <ModalShell title="Unlock Region" onClose={onClose}>
      <InlineAlert
        type="error"
        message="ACCRUED reserve ledger entries created during the lock will be reversed (deleted)."
      />
      {error && <InlineAlert type="error" message={error} />}
      <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
        Reason (optional, recommended)
      </label>
      <textarea
        className="ui-input min-h-[80px] w-full"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex justify-end gap-2 pt-2">
        <ActionButton variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </ActionButton>
        <ActionButton variant="danger" onClick={submit} disabled={busy}>
          {busy ? "Unlocking…" : "Confirm Unlock"}
        </ActionButton>
      </div>
    </ModalShell>
  )
}

function GlobalFinalizeModal({
  scope,
  onClose,
  onDone,
}: {
  scope: Scope
  onClose: () => void
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    const res = await postJson("/api/payroll/state/global-finalize", {
      month: scope.month,
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.message ?? "Failed to finalize.")
      return
    }
    onDone()
  }

  return (
    <ModalShell title="Globally Finalize" onClose={onClose}>
      <InlineAlert
        type="error"
        message="All REGIONAL_LOCKED payrolls for the month will be frozen as GLOBAL_FINALIZED."
      />
      {error && <InlineAlert type="error" message={error} />}
      <p className="text-sm text-[var(--text-muted)]">
        Month: <span className="font-mono">{scope.month}</span>
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <ActionButton variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </ActionButton>
        <ActionButton onClick={submit} disabled={busy}>
          {busy ? "Finalizing…" : "Confirm Global Finalize"}
        </ActionButton>
      </div>
    </ModalShell>
  )
}

function GlobalUnfinalizeModal({
  scope,
  onClose,
  onDone,
}: {
  scope: Scope
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!reason.trim()) {
      setError("A reason is required.")
      return
    }
    setBusy(true)
    setError(null)
    const res = await postJson("/api/payroll/state/global-unfinalize", {
      month: scope.month,
      reason: reason.trim(),
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.message ?? "Failed.")
      return
    }
    onDone()
  }

  return (
    <ModalShell title="Unfreeze Global Finalization" onClose={onClose}>
      <InlineAlert
        type="error"
        message="This reverts GLOBAL_FINALIZED payrolls back to REGIONAL_LOCKED."
      />
      {error && <InlineAlert type="error" message={error} />}
      <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
        Reason (required)
      </label>
      <textarea
        className="ui-input min-h-[100px] w-full"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex justify-end gap-2 pt-2">
        <ActionButton variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </ActionButton>
        <ActionButton variant="danger" onClick={submit} disabled={busy}>
          {busy ? "Reverting…" : "Confirm Unfreeze"}
        </ActionButton>
      </div>
    </ModalShell>
  )
}

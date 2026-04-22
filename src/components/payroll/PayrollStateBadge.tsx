"use client"

import { cn } from "@/lib/utils"

/**
 * Visual badge for the Payroll state machine.
 *
 * Pattern: matches `src/components/ui/status-chip.tsx` (rounded chip with bold
 * 0.75rem text). Falls back to inline tailwind classes for the states that
 * don't map cleanly onto the four `ui-chip-*` variants (purple/orange).
 */

export type PayrollState =
  | "DRAFT"
  | "CALCULATED"
  | "REGIONAL_LOCKED"
  | "GLOBAL_FINALIZED"
  | "PAID"
  | "HOLD"
  | "EMERGENCY_RELEASED"
  | string

type Props = {
  state: PayrollState
  reason?: string | null
  className?: string
}

const STATE_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  CALCULATED: "Calculated",
  REGIONAL_LOCKED: "Regional Locked",
  GLOBAL_FINALIZED: "Global Finalized",
  PAID: "Paid",
  HOLD: "On Hold",
  EMERGENCY_RELEASED: "Emergency Released",
}

const STATE_CLASSES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  CALCULATED: "bg-blue-100 text-blue-800",
  REGIONAL_LOCKED: "bg-amber-100 text-amber-800",
  GLOBAL_FINALIZED: "bg-purple-100 text-purple-800",
  PAID: "bg-green-100 text-green-800",
  HOLD: "bg-red-100 text-red-800",
  EMERGENCY_RELEASED: "bg-orange-100 text-orange-800",
}

export default function PayrollStateBadge({ state, reason, className }: Props) {
  const label = STATE_LABELS[state] ?? state
  const styles = STATE_CLASSES[state] ?? "bg-slate-100 text-slate-700"
  const showTooltip = (state === "HOLD" || state === "EMERGENCY_RELEASED") && reason

  return (
    <span
      className={cn(
        "ui-chip",
        styles,
        className
      )}
      title={showTooltip ? `Reason: ${reason}` : undefined}
    >
      {label}
      {showTooltip ? <span className="ml-1 opacity-70">ⓘ</span> : null}
    </span>
  )
}

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
  DRAFT: "bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300",
  CALCULATED: "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300",
  REGIONAL_LOCKED: "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300",
  GLOBAL_FINALIZED: "bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300",
  PAID: "bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300",
  HOLD: "bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300",
  EMERGENCY_RELEASED: "bg-orange-100 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300",
}

export default function PayrollStateBadge({ state, reason, className }: Props) {
  const label = STATE_LABELS[state] ?? state
  const styles = STATE_CLASSES[state] ?? "bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300"
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

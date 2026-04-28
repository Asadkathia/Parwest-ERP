"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Guard lifecycle / shadow status union.
 *
 * Source of truth for these names:
 * - `Guard.lifecycleStatus` -> PENDING | ACTIVE | INACTIVE | TERMINATED
 *   (prisma/schema.prisma:250)
 * - `Guard.status` (legacy shadow) -> PENDING | ACTIVE | PRESENT | DEFAULT |
 *   INACTIVE | TERMINATED (prisma/schema.prisma:249)
 * - `Guard.terminationReason` -> RESIGNED | FIRED | ABSCONDED | DECEASED |
 *   OTHER. Surfaced as termination sub-states for richer UI.
 *
 * The list page renders the legacy shadow `status`; this badge accepts the
 * full union so the same component can be reused on the profile / history
 * tabs without a separate variant per surface.
 */
export type GuardStatus =
  | "PENDING"
  | "ACTIVE"
  | "PRESENT"
  | "DEFAULT"
  | "INACTIVE"
  | "TERMINATED"
  | "RESIGNED"
  | "FIRED"
  | "ABSCONDED"
  | "DECEASED"
  | "OTHER"

const BASE_CLASS =
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"

/**
 * Map each lifecycle / shadow status to a Tailwind colour pair using v1.0
 * brandbook semantic tokens. Always pairs background + text + border so the
 * pill stays readable in both themes.
 */
function variantClass(status: GuardStatus): string {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
    case "PRESENT":
      return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900"
    case "PENDING":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
    case "DEFAULT":
      return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-700"
    case "INACTIVE":
      return "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900/60 dark:text-zinc-300 dark:border-zinc-700"
    case "TERMINATED":
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
    case "RESIGNED":
      return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900"
    case "FIRED":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900"
    case "ABSCONDED":
      return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900"
    case "DECEASED":
      return "bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-900/60 dark:text-neutral-300 dark:border-neutral-700"
    case "OTHER":
    default:
      return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-700"
  }
}

/**
 * Human-friendly label. Per accessibility charter we ALWAYS render the label
 * text — colour alone is never sufficient.
 */
function labelFor(status: GuardStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Active"
    case "PRESENT":
      return "Present"
    case "PENDING":
      return "Pending"
    case "DEFAULT":
      return "Default"
    case "INACTIVE":
      return "Inactive"
    case "TERMINATED":
      return "Terminated"
    case "RESIGNED":
      return "Resigned"
    case "FIRED":
      return "Fired"
    case "ABSCONDED":
      return "Absconded"
    case "DECEASED":
      return "Deceased"
    case "OTHER":
      return "Other"
    default:
      return String(status)
  }
}

export interface GuardStatusBadgeProps {
  status: GuardStatus | string
  className?: string
}

export function GuardStatusBadge({
  status,
  className,
}: GuardStatusBadgeProps): React.ReactElement {
  const normalized = String(status).toUpperCase() as GuardStatus
  return (
    <span
      className={cn(BASE_CLASS, variantClass(normalized), className)}
      data-status={normalized}
      aria-label={`Guard status: ${labelFor(normalized)}`}
    >
      {labelFor(normalized)}
    </span>
  )
}

export default GuardStatusBadge

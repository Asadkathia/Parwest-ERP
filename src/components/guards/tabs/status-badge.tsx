"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Lightweight status pill used by the read-only guard profile tabs
 * (Deployment / Status / Payment / Residence / Inventory history).
 *
 * Per the design system: variants pair bg+text+border tokens and the label
 * text is always rendered (colour alone is insufficient for accessibility).
 */
export type TabStatusVariant =
  | "success"   // ACTIVE / PAID / FULFILLED / CURRENT
  | "warning"   // PENDING / IN_PROGRESS
  | "muted"     // INACTIVE / VACATED / TERMINATED / CANCELLED
  | "destructive" // FAILED / BLOCKED / ERROR
  | "info"      // informational neutral

const VARIANT_CLASS: Record<TabStatusVariant, string> = {
  success:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  warning:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  muted:
    "bg-muted text-muted-foreground border-border",
  destructive:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  info:
    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
}

/**
 * Map a raw uppercase status string to a tab-status variant. Unknown values
 * fall back to muted.
 */
export function variantForStatus(raw: string | null | undefined): TabStatusVariant {
  const status = String(raw ?? "").toUpperCase()
  switch (status) {
    case "ACTIVE":
    case "PAID":
    case "FULFILLED":
    case "CURRENT":
    case "PRESENT":
      return "success"
    case "PENDING":
    case "IN_PROGRESS":
      return "warning"
    case "FAILED":
    case "BLOCKED":
    case "ERROR":
    case "TERMINATED":
    case "BLACKLISTED":
      return status === "TERMINATED" || status === "BLACKLISTED" ? "destructive" : "destructive"
    case "INACTIVE":
    case "VACATED":
    case "CANCELLED":
    case "ENDED":
      return "muted"
    case "MANUAL":
    case "SYSTEM":
    case "ENROLLMENT":
    case "BLACKLIST":
      return "info"
    default:
      return "muted"
  }
}

const BASE_CLASS =
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"

export interface TabStatusBadgeProps {
  /** Display label — always rendered, never colour-only. */
  label: string
  /** Explicit variant; if omitted falls back to status-derived variant. */
  variant?: TabStatusVariant
  /** Optional raw status string used to derive variant when `variant` omitted. */
  status?: string | null
  className?: string
}

export function TabStatusBadge({
  label,
  variant,
  status,
  className,
}: TabStatusBadgeProps): React.ReactElement {
  const v = variant ?? variantForStatus(status ?? label)
  return (
    <span
      className={cn(BASE_CLASS, VARIANT_CLASS[v], className)}
      aria-label={`Status: ${label}`}
    >
      {label}
    </span>
  )
}

export default TabStatusBadge

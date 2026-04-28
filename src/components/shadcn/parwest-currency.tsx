"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { formatPKRFull, formatPKRShort } from "@/lib/format/currency"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shadcn/tooltip"

export interface ParwestCurrencyProps {
  value: number
  /** When true (default), render the short form with a tooltip showing the full form. */
  compact?: boolean
  className?: string
}

const BASE_CLASS = "font-mono tabular-nums whitespace-nowrap"

/**
 * Renders a PKR value using the design-system v1.1 currency conventions.
 * - compact=true  -> short form ("₨ 4.2L") inside a tooltip whose body is the full form ("₨ 4,24,00,000").
 * - compact=false -> full form rendered directly, no tooltip.
 *
 * Negative values use the destructive token; zero values use muted-foreground.
 */
export function ParwestCurrency({
  value,
  compact = true,
  className,
}: ParwestCurrencyProps) {
  const isNegative = Number.isFinite(value) && value < 0
  const isZero = Number.isFinite(value) && value === 0

  const colorClass = isNegative
    ? "text-destructive"
    : isZero
      ? "text-muted-foreground"
      : undefined

  if (!compact) {
    return (
      <span dir="ltr" className={cn(BASE_CLASS, colorClass, className)}>
        {formatPKRFull(value)}
      </span>
    )
  }

  const short = formatPKRShort(value)
  const full = formatPKRFull(value)

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span dir="ltr" className={cn(BASE_CLASS, colorClass, className)}>{short}</span>
        </TooltipTrigger>
        <TooltipContent dir="ltr">{full}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default ParwestCurrency

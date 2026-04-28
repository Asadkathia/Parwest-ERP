import { cn } from "@/lib/utils"
import { Badge } from "@/components/shadcn/badge"

/**
 * DEPRECATED — compatibility shim during the v1.1 migration.
 * New code should use shadcn `Badge` directly from `@/components/shadcn/badge`.
 */

export type ChipVariant = "neutral" | "success" | "warning" | "danger"

type Props = {
  label: string
  variant?: ChipVariant
  className?: string
}

const VARIANT_CLASSES: Record<ChipVariant, string> = {
  neutral:
    "bg-secondary text-secondary-foreground border-transparent",
  success:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-transparent",
  warning:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-transparent",
  danger:
    "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-transparent",
}

export default function StatusChip({ label, variant = "neutral", className }: Props) {
  return (
    <Badge className={cn("font-bold", VARIANT_CLASSES[variant], className)}>
      {label}
    </Badge>
  )
}

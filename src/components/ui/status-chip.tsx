import { cn } from "@/lib/utils"

export type ChipVariant = "neutral" | "success" | "warning" | "danger"

type Props = {
  label: string
  variant?: ChipVariant
  className?: string
}

export default function StatusChip({ label, variant = "neutral", className }: Props) {
  return (
    <span
      className={cn(
        "ui-chip",
        variant === "neutral" && "ui-chip-neutral",
        variant === "success" && "ui-chip-success",
        variant === "warning" && "ui-chip-warning",
        variant === "danger" && "ui-chip-danger",
        className
      )}
    >
      {label}
    </span>
  )
}

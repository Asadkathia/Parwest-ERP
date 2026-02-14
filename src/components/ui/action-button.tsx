import { cn } from "@/lib/utils"

export type ButtonVariant = "primary" | "secondary" | "danger"

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

export default function ActionButton({ className, variant = "primary", ...props }: Props) {
  return (
    <button
      className={cn(
        "ui-btn",
        variant === "primary" && "ui-btn-primary",
        variant === "secondary" && "ui-btn-secondary",
        variant === "danger" && "ui-btn-danger",
        className
      )}
      {...props}
    />
  )
}

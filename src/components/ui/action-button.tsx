import { forwardRef } from "react"
import { Button } from "@/components/shadcn/button"
import type { VariantProps } from "class-variance-authority"

/**
 * DEPRECATED — compatibility shim during the v1.1 migration.
 * New code should use shadcn `Button` directly from `@/components/shadcn/button`.
 */

export type ButtonVariant = "primary" | "secondary" | "danger"

type ShadcnVariant = NonNullable<VariantProps<typeof Button>["variant"]>

const VARIANT_MAP: Record<ButtonVariant, ShadcnVariant> = {
  primary: "default",
  secondary: "secondary",
  danger: "destructive",
}

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

const ActionButton = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", type = "button", ...props }, ref) => (
    <Button ref={ref} variant={VARIANT_MAP[variant]} type={type} {...props} />
  )
)
ActionButton.displayName = "ActionButton"

export default ActionButton

import { forwardRef } from "react"
import { cn } from "@/lib/utils"
import {
  Card as ShadcnCard,
  CardHeader as ShadcnCardHeader,
  CardContent as ShadcnCardContent,
  CardFooter as ShadcnCardFooter,
} from "@/components/shadcn/card"

/**
 * DEPRECATED — compatibility shim during the v1.1 migration.
 * New code should use shadcn primitives directly from `@/components/shadcn/card`.
 * Legacy `CardBody` is aliased to shadcn `CardContent`. The legacy `variant`
 * prop is preserved on `Card`.
 */

export type CardVariant = "default" | "muted"

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <ShadcnCard
      ref={ref}
      className={cn(variant === "muted" && "bg-muted", className)}
      {...props}
    />
  )
)
Card.displayName = "Card"

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <ShadcnCardHeader
      ref={ref}
      className={cn("px-5 py-4 border-b", className)}
      {...props}
    />
  )
)
CardHeader.displayName = "CardHeader"

export const CardBody = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <ShadcnCardContent ref={ref} className={cn("p-5", className)} {...props} />
  )
)
CardBody.displayName = "CardBody"

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <ShadcnCardFooter
      ref={ref}
      className={cn("px-5 py-4 border-t", className)}
      {...props}
    />
  )
)
CardFooter.displayName = "CardFooter"

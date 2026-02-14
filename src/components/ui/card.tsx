import { cn } from "@/lib/utils"

export type CardVariant = "default" | "muted"

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant
}

export function Card({ className, variant = "default", ...props }: CardProps) {
  return (
    <div
      className={cn("ui-card", variant === "muted" && "bg-[var(--surface-muted)]", className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4 border-b border-[var(--border)]", className)} {...props} />
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4 border-t border-[var(--border)]", className)} {...props} />
}

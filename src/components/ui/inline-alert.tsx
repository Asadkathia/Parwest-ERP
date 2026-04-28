import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { CheckCircle2, AlertCircle } from "lucide-react"

/**
 * DEPRECATED — compatibility shim during the v1.1 migration.
 * New code should use shadcn `Alert` directly from `@/components/shadcn/alert`.
 */

type Props = {
  type: "success" | "error"
  message: string
}

const TYPE_CLASSES: Record<Props["type"], string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300",
  error:
    "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300",
}

export default function InlineAlert({ type, message }: Props) {
  const Icon = type === "success" ? CheckCircle2 : AlertCircle
  return (
    <Alert className={cn(TYPE_CLASSES[type])}>
      <Icon className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

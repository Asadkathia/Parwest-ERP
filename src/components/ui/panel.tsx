import { cn } from "@/lib/utils"

export default function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <aside className={cn("ui-panel p-4", className)} {...props} />
}

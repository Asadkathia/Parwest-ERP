import Link from "next/link"
import { AlertTriangle, AlertCircle, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AttentionItem } from "@/lib/dashboard/queries"

export default function AttentionStrip({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="ui-card divide-y divide-[var(--border)] overflow-hidden">
      {items.map((item) => {
        const Icon = item.tone === "danger" ? AlertCircle : AlertTriangle
        return (
          <Link
            key={item.key}
            href={item.href}
            className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[var(--surface-muted)] transition"
          >
            <div className="flex items-center gap-2.5">
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  item.tone === "danger" ? "text-red-600" : "text-amber-600"
                )}
              />
              <span className="text-sm font-medium text-[var(--text)]">{item.label}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
          </Link>
        )
      })}
    </div>
  )
}

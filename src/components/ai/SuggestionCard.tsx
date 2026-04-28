import type { ShshkSuggestion } from "@/lib/shshk/types"
import { Badge } from "@/components/shadcn/badge"

function priorityVariantClass(priority: ShshkSuggestion["priority"]) {
  if (priority === "HIGH") return "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-transparent"
  if (priority === "MEDIUM") return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-transparent"
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-transparent"
}

export default function SuggestionCard({ suggestion }: { suggestion: ShshkSuggestion }) {
  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-xs)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--text)]">{suggestion.title}</h3>
        <Badge className={`font-bold ${priorityVariantClass(suggestion.priority)}`}>{suggestion.priority}</Badge>
      </div>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{suggestion.rationale}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
        <Badge className={"font-bold bg-secondary text-secondary-foreground border-transparent"}>{suggestion.category}</Badge>
        <span>Impacted: {suggestion.impactedEntities}</span>
      </div>
      <p className="mt-3 text-sm font-medium text-[var(--text)]">{suggestion.recommendation}</p>
    </article>
  )
}

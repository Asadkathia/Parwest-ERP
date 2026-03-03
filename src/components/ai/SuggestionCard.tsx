import StatusChip from "@/components/ui/status-chip"
import type { ShshkSuggestion } from "@/lib/shshk/types"

function priorityVariant(priority: ShshkSuggestion["priority"]) {
  if (priority === "HIGH") return "danger"
  if (priority === "MEDIUM") return "warning"
  return "success"
}

export default function SuggestionCard({ suggestion }: { suggestion: ShshkSuggestion }) {
  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-xs)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--text)]">{suggestion.title}</h3>
        <StatusChip label={suggestion.priority} variant={priorityVariant(suggestion.priority)} />
      </div>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{suggestion.rationale}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
        <StatusChip label={suggestion.category} variant="neutral" />
        <span>Impacted: {suggestion.impactedEntities}</span>
      </div>
      <p className="mt-3 text-sm font-medium text-[var(--text)]">{suggestion.recommendation}</p>
    </article>
  )
}

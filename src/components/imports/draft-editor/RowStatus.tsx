"use client"
import { Button } from "@/components/shadcn/button"
import { CheckCircle2, AlertCircle, CircleOff } from "lucide-react"
import type { DraftRow } from "@/lib/imports/client/useDraft"

export function RowStatus({ row, onToggleSkip }: { row: DraftRow; onToggleSkip: (next: boolean) => void }) {
  if (row.skipped) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <CircleOff className="h-3.5 w-3.5" /> Skipped
        </span>
        {row.errors.length > 0 ? (
          <span
            className="inline-flex items-center gap-1 text-destructive"
            title={row.errors.map((e) => e.message).join("; ")}
          >
            <AlertCircle className="h-3.5 w-3.5" /> {row.errors.length} error{row.errors.length === 1 ? "" : "s"}
          </span>
        ) : null}
        <Button type="button" variant="ghost" size="sm" className="h-6 px-2" onClick={() => onToggleSkip(false)} aria-pressed="true">
          Unskip
        </Button>
      </div>
    )
  }
  if (row.errors.length > 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-destructive">
          <AlertCircle className="h-3.5 w-3.5" /> {row.errors.length} error{row.errors.length === 1 ? "" : "s"}
        </span>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-2" onClick={() => onToggleSkip(true)} aria-pressed="false">
          Skip
        </Button>
      </div>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" /> Valid
    </span>
  )
}

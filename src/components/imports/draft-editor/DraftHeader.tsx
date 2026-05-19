"use client"
import { Button } from "@/components/shadcn/button"
import { CheckCircle2, AlertCircle, CircleOff } from "lucide-react"

export function DraftHeader({
  fileName, status, expiresAt, totals, onDiscard, onFinalize, finalizing,
}: {
  fileName: string | null
  status: string
  expiresAt: string | null
  totals: { valid: number; errored: number; skipped: number; total: number }
  onDiscard: () => void
  onFinalize: () => void
  finalizing: boolean
}) {
  const canFinalize = totals.errored === 0 && totals.valid > 0
  const exp = expiresAt ? new Date(expiresAt) : null
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-4 border-b bg-background/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {fileName ?? "Untitled draft"}{" "}
            <span className="ml-2 inline-flex rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {status}
            </span>
          </p>
          {exp && <p className="text-xs text-muted-foreground">Expires {exp.toLocaleString("en-PK")}</p>}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> {totals.valid} valid
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <CircleOff className="h-4 w-4" /> {totals.skipped} skipped
          </span>
          <span className={`inline-flex items-center gap-1 ${totals.errored > 0 ? "text-destructive" : "text-muted-foreground"}`}>
            <AlertCircle className="h-4 w-4" /> {totals.errored} errors
          </span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onDiscard}>Discard</Button>
          <Button type="button" onClick={onFinalize} disabled={!canFinalize || finalizing}>
            {finalizing ? "Importing…" : `Import ${totals.valid} row${totals.valid === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </div>
  )
}

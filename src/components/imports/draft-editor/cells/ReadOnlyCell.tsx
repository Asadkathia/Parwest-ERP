"use client"
import { format, parseISO, isValid } from "date-fns"
import type { CellProps } from "./TextCell"
import type { ColumnKind } from "@/lib/imports/types"

type ReadOnlyCellProps = CellProps & { kind: ColumnKind }

/**
 * Non-editable display cell for values the persist layer computes itself
 * (e.g. joining date = date of import). For an empty date it shows today —
 * the date that will be stamped on import — tagged "auto" so the user sees
 * what will be stored without being able to change it.
 */
export function ReadOnlyCell({ value, kind }: ReadOnlyCellProps) {
  let text = value == null ? "" : String(value)
  let auto = false
  if (kind === "date") {
    if (!text) {
      text = format(new Date(), "yyyy-MM-dd")
      auto = true
    } else {
      const d = parseISO(text)
      if (isValid(d)) text = format(d, "yyyy-MM-dd")
    }
  }
  return (
    <div className="flex h-7 items-center gap-1.5 rounded-sm border border-input/20 bg-muted/30 px-2 text-sm text-muted-foreground">
      <span className="tabular-nums">{text || "—"}</span>
      {auto && <span className="text-[10px] uppercase tracking-wide opacity-60">auto</span>}
    </div>
  )
}

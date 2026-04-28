/**
 * Parwest ERP — Audit JSON diff viewer (Phase 7C)
 * ─────────────────────────────────────────────────────────────────────────
 * Two-pane Before / After viewer with key-level diff highlighting.
 *
 * Highlight strategy: shallow recursion over JSON-ish objects. For every key
 * in the union of both inputs:
 *   - present in `after` only           → green (added)
 *   - present in `before` only          → red   (removed)
 *   - both, but stringified differently → amber (changed)
 *   - identical                         → muted (unchanged)
 *
 * Nested objects are rendered as JSON inside their colored row (no recursive
 * coloring) — keeps the viewer simple and bounded for arbitrarily deep blobs.
 *
 * Audit logs in this codebase don't currently store before/after JSON
 * (description is a free-form string). The viewer falls back gracefully:
 * if `before`/`after` are both null, we render a single "Record" pane with
 * the raw row JSON so the action is still inspectable.
 */

"use client"

import * as React from "react"
import { Copy } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/shadcn/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card"
import { cn } from "@/lib/utils"

type Json = unknown

function stableStringify(value: Json): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

type DiffKind = "added" | "removed" | "changed" | "same"

type DiffRow = {
  key: string
  kind: DiffKind
  before: Json
  after: Json
}

function isPlainObject(value: unknown): value is Record<string, Json> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function buildDiff(before: Json, after: Json): DiffRow[] {
  const a = isPlainObject(before) ? before : {}
  const b = isPlainObject(after) ? after : {}
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort()
  return keys.map((key) => {
    const inA = key in a
    const inB = key in b
    if (inA && !inB) return { key, kind: "removed", before: a[key], after: undefined }
    if (!inA && inB) return { key, kind: "added", before: undefined, after: b[key] }
    const sa = stableStringify(a[key])
    const sb = stableStringify(b[key])
    if (sa === sb) return { key, kind: "same", before: a[key], after: b[key] }
    return { key, kind: "changed", before: a[key], after: b[key] }
  })
}

function rowClasses(kind: DiffKind): string {
  switch (kind) {
    case "added":
      return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
    case "removed":
      return "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
    case "changed":
      return "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
    default:
      return "text-muted-foreground"
  }
}

function isNumericLike(value: Json): boolean {
  if (typeof value === "number") return true
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return true
  return false
}

function renderValue(value: Json): React.ReactNode {
  if (value === undefined) return <span className="opacity-60">—</span>
  if (value === null) return <span className="opacity-60">null</span>
  if (typeof value === "object") return stableStringify(value)
  return String(value)
}

function CopyButton({ payload, label }: { payload: string; label: string }) {
  const onCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(payload)
      toast.success(`${label} copied to clipboard`)
    } catch {
      toast.error("Copy failed")
    }
  }, [payload, label])
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onCopy}
      aria-label={`Copy ${label}`}
    >
      <Copy className="me-1 h-3 w-3" />
      Copy
    </Button>
  )
}

function Pane({
  title,
  rows,
  side,
  raw,
}: {
  title: string
  rows: DiffRow[]
  side: "before" | "after"
  raw: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 py-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <CopyButton payload={raw} label={title} />
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length === 0 ? (
          <pre dir="ltr" className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            (empty)
          </pre>
        ) : (
          <pre dir="ltr" className="overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs">
            {rows.map((row) => {
              const value = side === "before" ? row.before : row.after
              const visible = side === "before" ? row.kind !== "added" : row.kind !== "removed"
              const numeric = isNumericLike(value)
              return (
                <div
                  key={row.key}
                  className={cn(
                    "rounded px-2 py-0.5",
                    visible ? rowClasses(row.kind) : "opacity-30",
                    numeric && "tabular-nums"
                  )}
                >
                  <span className="font-medium">{row.key}</span>
                  <span className="opacity-70">: </span>
                  <span className="whitespace-pre-wrap break-words">
                    {visible ? renderValue(value) : <span className="italic">—</span>}
                  </span>
                </div>
              )
            })}
          </pre>
        )}
      </CardContent>
    </Card>
  )
}

export interface JsonDiffViewerProps {
  before?: Json
  after?: Json
  /** Single-pane fallback (when before/after aren't available). */
  record?: Json
  className?: string
}

export default function JsonDiffViewer({
  before,
  after,
  record,
  className,
}: JsonDiffViewerProps) {
  const hasDiff = before !== undefined || after !== undefined
  if (!hasDiff) {
    const raw = stableStringify(record ?? null)
    return (
      <div className={className}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 py-3">
            <CardTitle className="text-sm font-semibold">Record</CardTitle>
            <CopyButton payload={raw} label="Record" />
          </CardHeader>
          <CardContent className="pt-0">
            <pre dir="ltr" className="overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              {raw}
            </pre>
          </CardContent>
        </Card>
      </div>
    )
  }
  const rows = buildDiff(before, after)
  const beforeRaw = stableStringify(before ?? null)
  const afterRaw = stableStringify(after ?? null)
  return (
    <div className={cn("grid grid-cols-1 gap-3 md:grid-cols-2", className)}>
      <Pane title="Before" rows={rows} side="before" raw={beforeRaw} />
      <Pane title="After" rows={rows} side="after" raw={afterRaw} />
    </div>
  )
}

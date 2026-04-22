"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardBody, CardHeader } from "@/components/ui/card"
import SectionTitle from "@/components/ui/section-title"
import { cn } from "@/lib/utils"
import { AlertTriangle, Sparkles, ChevronDown, ChevronRight, Clock, BellOff, Settings2 } from "lucide-react"

type Severity = "HIGH" | "MEDIUM" | "LOW"
type Category = "EFFICIENCY" | "ANOMALY"

type DrillItem = {
  id: string
  label: string
  sub?: string | null
  href?: string | null
  amount?: number | null
}

type InsightResult = {
  key: string
  title: string
  description: string
  category: Category
  severity: Severity
  count: number
  amount?: number
  summary: string
  drillUrl?: string
  items?: DrillItem[]
  muted: boolean
  mutedUntil: string | null
  mutedReason: string | null
  error?: string
  durationMs: number
}

type Tab = "EFFICIENCY" | "ANOMALY"

function sevClasses(sev: Severity) {
  if (sev === "HIGH") return "border-l-red-500 bg-red-50"
  if (sev === "MEDIUM") return "border-l-amber-500 bg-amber-50/60"
  return "border-l-slate-300 bg-slate-50"
}

function sevPill(sev: Severity) {
  if (sev === "HIGH") return "bg-red-100 text-red-700"
  if (sev === "MEDIUM") return "bg-amber-100 text-amber-700"
  return "bg-slate-100 text-slate-600"
}

export default function InsightsPanel({ canManage }: { canManage: boolean }) {
  const [tab, setTab] = useState<Tab>("EFFICIENCY")
  const [data, setData] = useState<InsightResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/insights?category=${tab}`, { cache: "no-store" })
        const json = await res.json()
        if (!json.success) throw new Error(json.message || "Failed to load insights")
        if (!cancelled) setData(json.data.results)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load insights")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [tab])

  const results = data ?? []
  const withIssues = results.filter((r) => r.count > 0)
  const healthy = results.length - withIssues.length

  return (
    <Card>
      <CardHeader>
        <SectionTitle
          title="Operational Insights"
          subtitle={
            loading
              ? "Computing…"
              : `${withIssues.length} flag${withIssues.length === 1 ? "" : "s"} · ${healthy} clean`
          }
          action={
            canManage ? (
              <Link
                href="/settings/insights"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand)] hover:underline"
              >
                <Settings2 className="h-4 w-4" />
                Configure
              </Link>
            ) : null
          }
        />
        <div className="mt-3 flex gap-1 rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-1">
          <TabButton active={tab === "EFFICIENCY"} onClick={() => setTab("EFFICIENCY")}>
            <Sparkles className="h-3.5 w-3.5" />
            Efficiency
          </TabButton>
          <TabButton active={tab === "ANOMALY"} onClick={() => setTab("ANOMALY")}>
            <AlertTriangle className="h-3.5 w-3.5" />
            Anomalies
          </TabButton>
        </div>
      </CardHeader>
      <CardBody className="space-y-2">
        {error ? (
          <p className="rounded-[var(--radius-md)] bg-red-50 p-3 text-sm text-red-700">{error}</p>
        ) : results.length === 0 && !loading ? (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">No insights in this category.</p>
        ) : (
          results.map((r) => <InsightRow key={r.key} r={r} />)
        )}
      </CardBody>
    </Card>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-semibold transition",
        active ? "bg-white text-[var(--text)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text)]"
      )}
    >
      {children}
    </button>
  )
}

function InsightRow({ r }: { r: InsightResult }) {
  const [open, setOpen] = useState(false)
  const hasDrill = (r.items?.length ?? 0) > 0 || !!r.drillUrl
  const hasIssue = r.count > 0

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-md)] border-l-4 border border-[var(--border)]",
        hasIssue ? sevClasses(r.severity) : "bg-white"
      )}
    >
      <button
        type="button"
        onClick={() => hasDrill && setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-[var(--text)]">{r.title}</p>
            {hasIssue ? (
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", sevPill(r.severity))}>
                {r.severity}
              </span>
            ) : null}
            {r.error ? <span className="text-[10px] text-red-600">error</span> : null}
          </div>
          <p className="truncate text-xs text-[var(--text-muted)]">{r.summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {hasIssue && r.amount ? (
            <span className="text-sm font-bold text-red-600">₨ {formatShort(r.amount)}</span>
          ) : null}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-bold",
              hasIssue ? "bg-white text-[var(--text)] shadow-sm" : "bg-emerald-100 text-emerald-700"
            )}
          >
            {hasIssue ? r.count : "✓"}
          </span>
          {hasDrill ? (
            open ? (
              <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
            ) : (
              <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
            )
          ) : null}
        </div>
      </button>
      {open && hasDrill ? (
        <div className="border-t border-[var(--border)] bg-white px-3 py-2">
          {r.items && r.items.length > 0 ? (
            <ul className="divide-y divide-[var(--border)]">
              {r.items.map((it) => (
                <li key={it.id}>
                  {it.href ? (
                    <Link
                      href={it.href}
                      className="flex items-center justify-between gap-3 py-2 text-sm hover:text-[var(--brand)]"
                    >
                      <RowBody item={it} />
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between gap-3 py-2 text-sm">
                      <RowBody item={it} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          {r.drillUrl ? (
            <Link
              href={r.drillUrl}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand)] hover:underline"
            >
              Investigate all →
            </Link>
          ) : null}
          {r.durationMs > 0 ? (
            <p className="mt-2 flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <Clock className="h-3 w-3" />
              computed in {r.durationMs}ms
            </p>
          ) : null}
          {r.muted ? (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <BellOff className="h-3 w-3" />
              muted{r.mutedUntil ? ` until ${new Date(r.mutedUntil).toLocaleDateString()}` : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function RowBody({ item }: { item: DrillItem }) {
  return (
    <>
      <div className="min-w-0">
        <p className="truncate font-medium">{item.label}</p>
        {item.sub ? <p className="truncate text-xs text-[var(--text-muted)]">{item.sub}</p> : null}
      </div>
      {typeof item.amount === "number" ? (
        <span className="shrink-0 text-sm font-semibold text-[var(--text)]">₨ {formatShort(item.amount)}</span>
      ) : null}
    </>
  )
}

function formatShort(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_00_00_000) return `${(n / 1_00_00_000).toFixed(1)}Cr`
  if (abs >= 1_00_000) return `${(n / 1_00_000).toFixed(1)}L`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

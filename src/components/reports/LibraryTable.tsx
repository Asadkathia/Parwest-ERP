"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/shadcn/button"
import { Input } from "@/components/shadcn/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"

interface Row {
  id: string
  reportKey: string
  format: string
  status: string
  rowCount: number | null
  createdAt: string
  error: string | null
  requestedBy: { name: string | null; email: string | null } | null
}

interface CatalogItem {
  key: string
  title: string
}

const STATUSES = ["all", "PENDING", "RUNNING", "SUCCEEDED", "FAILED"] as const

export function LibraryTable() {
  const [rows, setRows] = useState<Row[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [reportKey, setReportKey] = useState<string>("all")
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const fetchSeq = useRef(0)
  function fetchRows(filters: {
    reportKey: string
    status: string
    from: string
    to: string
  }) {
    const seq = ++fetchSeq.current
    const qs = new URLSearchParams()
    if (filters.reportKey !== "all") qs.set("reportKey", filters.reportKey)
    if (filters.status !== "all") qs.set("status", filters.status)
    if (filters.from) qs.set("from", filters.from)
    if (filters.to) qs.set("to", filters.to)
    setLoading(true)
    fetch(`/api/reports/library?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (seq !== fetchSeq.current) return
        setRows(d.data ?? [])
        setLoading(false)
      })
      .catch(() => {
        if (seq === fetchSeq.current) setLoading(false)
      })
  }

  useEffect(() => {
    let cancelled = false
    fetch("/api/reports/catalog")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setCatalog(d.data ?? [])
      })
      .catch(() => {})
    queueMicrotask(() => {
      if (!cancelled) {
        fetchRows({ reportKey: "all", status: "all", from: "", to: "" })
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  function update<K extends keyof FilterState>(
    setter: (v: string) => void,
    key: K,
    v: string
  ) {
    setter(v)
    const next: FilterState = { reportKey, status, from, to, [key]: v }
    fetchRows(next)
  }
  type FilterState = {
    reportKey: string
    status: string
    from: string
    to: string
  }

  const reportTitle = useMemo(() => {
    const map = new Map(catalog.map((c) => [c.key, c.title]))
    return (key: string) => map.get(key) ?? key
  }, [catalog])

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-5">
        <Select
          value={reportKey}
          onValueChange={(v) => update(setReportKey, "reportKey", v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reports</SelectItem>
            {catalog.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) =>
            update(
              (s) => setStatus(s as (typeof STATUSES)[number]),
              "status",
              v
            )
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "Any status" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={from}
          onChange={(e) => update(setFrom, "from", e.target.value)}
          aria-label="From"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => update(setTo, "to", e.target.value)}
          aria-label="To"
        />
        <Button
          variant="outline"
          onClick={() => fetchRows({ reportKey, status, from, to })}
        >
          Refresh
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-2">Report</th>
              <th className="p-2">Format</th>
              <th className="p-2">Status</th>
              <th className="p-2">Rows</th>
              <th className="p-2">Requested by</th>
              <th className="p-2">When</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={7}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={7}>
                  No runs match the filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{reportTitle(r.reportKey)}</td>
                  <td className="p-2">{r.format}</td>
                  <td className="p-2">
                    <span
                      className={
                        r.status === "FAILED"
                          ? "text-destructive"
                          : r.status === "SUCCEEDED"
                          ? "text-emerald-600"
                          : "text-muted-foreground"
                      }
                    >
                      {r.status}
                    </span>
                    {r.error ? (
                      <div className="text-xs text-destructive">{r.error}</div>
                    ) : null}
                  </td>
                  <td className="p-2">{r.rowCount ?? "—"}</td>
                  <td className="p-2">
                    {r.requestedBy?.name ?? r.requestedBy?.email ?? "—"}
                  </td>
                  <td className="p-2">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="p-2">
                    {r.status === "SUCCEEDED" ? (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={`/api/reports/library/${r.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

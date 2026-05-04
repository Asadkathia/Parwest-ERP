"use client"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/shadcn/button"
import { Input } from "@/components/shadcn/input"
import { Label } from "@/components/shadcn/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"
import { useRegions } from "@/lib/hooks/useRegions"
import type { ReportColumn } from "@/lib/reports/types"

export interface ParamShape {
  name: string
  type: "string" | "number" | "date" | "boolean"
  optional: boolean
}

interface RunResultData {
  runId: string
  rowCount: number
  downloadUrl: string
}

const RANGE_PRESETS: Array<{
  key: string
  label: string
  compute: () => { from: string; to: string }
}> = [
  {
    key: "7d",
    label: "Last 7 days",
    compute: () => {
      const to = new Date()
      const from = new Date(to.getTime() - 7 * 24 * 3600 * 1000)
      return { from: iso(from), to: iso(to) }
    },
  },
  {
    key: "30d",
    label: "Last 30 days",
    compute: () => {
      const to = new Date()
      const from = new Date(to.getTime() - 30 * 24 * 3600 * 1000)
      return { from: iso(from), to: iso(to) }
    },
  },
  {
    key: "month",
    label: "This month",
    compute: () => {
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: iso(from), to: iso(now) }
    },
  },
  {
    key: "ytd",
    label: "Year to date",
    compute: () => {
      const now = new Date()
      const from = new Date(now.getFullYear(), 0, 1)
      return { from: iso(from), to: iso(now) }
    },
  },
]

function iso(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function ReportRunner(props: {
  reportKey: string
  title: string
  description: string
  paramShape: ParamShape[]
  columns: ReportColumn[]
}) {
  const [vals, setVals] = useState<Record<string, string>>({})
  const [last, setLast] = useState<RunResultData | null>(null)
  const [busy, setBusy] = useState(false)
  const { regions } = useRegions()

  const hasFromTo =
    props.paramShape.some((p) => p.name === "from") &&
    props.paramShape.some((p) => p.name === "to")
  const hasRegion = props.paramShape.some((p) => p.name === "regionId")

  function applyPreset(key: string) {
    const preset = RANGE_PRESETS.find((p) => p.key === key)
    if (!preset) return
    const { from, to } = preset.compute()
    setVals((v) => ({ ...v, from, to }))
  }

  async function run(format: "csv" | "xlsx" | "pdf") {
    setBusy(true)
    try {
      const params: Record<string, unknown> = {}
      for (const p of props.paramShape) {
        const v = vals[p.name]
        if (!v) {
          if (!p.optional) throw new Error(`Missing parameter: ${p.name}`)
          continue
        }
        params[p.name] = p.type === "number" ? Number(v) : v
      }
      const res = await fetch(`/api/reports/run/${props.reportKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, params }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message ?? "Run failed")
      setLast(data.data as RunResultData)
      toast.success(`Generated ${data.data.rowCount} rows`)
      window.open(data.data.downloadUrl, "_blank")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>{props.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{props.description}</p>

          {hasFromTo ? (
            <div className="space-y-1">
              <Label>Quick range</Label>
              <div className="flex flex-wrap gap-1">
                {RANGE_PRESETS.map((p) => (
                  <Button
                    key={p.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(p.key)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {props.paramShape.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No parameters required.
            </p>
          ) : (
            props.paramShape.map((p) => {
              if (p.name === "regionId" && hasRegion) {
                return (
                  <div key={p.name} className="space-y-1">
                    <Label htmlFor={`p-${p.name}`}>
                      Region{p.optional ? "" : " *"}
                    </Label>
                    <Select
                      value={vals[p.name] ?? ""}
                      onValueChange={(v) =>
                        setVals((cur) => ({ ...cur, [p.name]: v }))
                      }
                    >
                      <SelectTrigger id={`p-${p.name}`}>
                        <SelectValue placeholder="All regions" />
                      </SelectTrigger>
                      <SelectContent>
                        {regions.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              }
              return (
                <div key={p.name} className="space-y-1">
                  <Label htmlFor={`p-${p.name}`}>
                    {labelize(p.name)}
                    {p.optional ? "" : " *"}
                  </Label>
                  <Input
                    id={`p-${p.name}`}
                    type={
                      p.type === "date"
                        ? "date"
                        : p.type === "number"
                        ? "number"
                        : "text"
                    }
                    value={vals[p.name] ?? ""}
                    onChange={(e) =>
                      setVals((v) => ({ ...v, [p.name]: e.target.value }))
                    }
                  />
                </div>
              )
            })
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={() => run("xlsx")} disabled={busy}>
              Run · XLSX
            </Button>
            <Button variant="outline" onClick={() => run("csv")} disabled={busy}>
              CSV
            </Button>
            <Button variant="outline" onClick={() => run("pdf")} disabled={busy}>
              PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Last run</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {last ? (
            <>
              <div>
                <span className="text-muted-foreground">Run ID:</span>{" "}
                <span className="font-mono text-xs">{last.runId}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Rows:</span>{" "}
                {last.rowCount.toLocaleString()}
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={last.downloadUrl} target="_blank" rel="noreferrer">
                  Re-download
                </a>
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground">
              Configure parameters and run.
            </span>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function labelize(name: string): string {
  return name
    .replace(/Id$/i, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}

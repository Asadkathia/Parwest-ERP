"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/shadcn/button"
import { Input } from "@/components/shadcn/input"
import { Label } from "@/components/shadcn/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"

interface CatalogItem {
  key: string
  title: string
}

const FORMATS = ["XLSX", "CSV", "PDF"] as const

interface ExistingScheduled {
  id: string
  reportKey: string
  cron: string
  timezone: string
  recipients: string[]
  formats: string[]
  active: boolean
  paramsJson: Record<string, unknown>
}

export function ScheduledReportForm({
  existing,
}: {
  existing?: ExistingScheduled
}) {
  const router = useRouter()
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [reportKey, setReportKey] = useState(existing?.reportKey ?? "")
  const [cron, setCron] = useState(existing?.cron ?? "0 7 * * *")
  const [tz, setTz] = useState(existing?.timezone ?? "Asia/Karachi")
  const [recipients, setRecipients] = useState(
    (existing?.recipients ?? []).join(",")
  )
  const [formats, setFormats] = useState<string[]>(
    existing?.formats ?? ["XLSX"]
  )
  const [active, setActive] = useState(existing?.active ?? true)
  const [paramsJson] = useState<Record<string, unknown>>(
    existing?.paramsJson ?? {}
  )

  useEffect(() => {
    fetch("/api/reports/catalog")
      .then((r) => r.json())
      .then((d) => setCatalog(d.data ?? []))
      .catch(() => {})
  }, [])

  async function save() {
    const body = {
      reportKey,
      cron,
      timezone: tz,
      recipients: recipients
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      formats,
      active,
      paramsJson,
    }
    const url = existing
      ? `/api/reports/scheduled/${existing.id}`
      : "/api/reports/scheduled"
    const method = existing ? "PATCH" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!data.success) {
      toast.error(data.message ?? "Save failed")
      return
    }
    toast.success("Saved")
    router.push("/reports/scheduled")
    router.refresh()
  }

  async function remove() {
    if (!existing) return
    if (!confirm("Delete this schedule?")) return
    await fetch(`/api/reports/scheduled/${existing.id}`, { method: "DELETE" })
    router.push("/reports/scheduled")
    router.refresh()
  }

  return (
    <div className="grid gap-3 max-w-xl">
      <div>
        <Label>Report</Label>
        <Select value={reportKey} onValueChange={setReportKey}>
          <SelectTrigger>
            <SelectValue placeholder="Pick a report" />
          </SelectTrigger>
          <SelectContent>
            {catalog.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Cron expression</Label>
        <Input value={cron} onChange={(e) => setCron(e.target.value)} />
        <p className="text-xs text-muted-foreground mt-1">
          5-field cron, e.g. <code>0 7 * * *</code> for daily 07:00.
        </p>
      </div>
      <div>
        <Label>Timezone</Label>
        <Input value={tz} onChange={(e) => setTz(e.target.value)} />
      </div>
      <div>
        <Label>Recipients (comma-separated)</Label>
        <Input
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
        />
      </div>
      <div>
        <Label>Formats</Label>
        <div className="flex gap-3">
          {FORMATS.map((f) => (
            <label key={f} className="text-sm flex items-center gap-1">
              <input
                type="checkbox"
                checked={formats.includes(f)}
                onChange={(e) =>
                  setFormats((cur) =>
                    e.target.checked ? [...cur, f] : cur.filter((x) => x !== f)
                  )
                }
              />
              {f}
            </label>
          ))}
        </div>
      </div>
      <label className="text-sm flex items-center gap-2">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Active
      </label>
      <div className="flex gap-2 pt-2">
        <Button onClick={save}>Save</Button>
        {existing ? (
          <Button variant="destructive" onClick={remove}>
            Delete
          </Button>
        ) : null}
      </div>
    </div>
  )
}

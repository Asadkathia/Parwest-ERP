"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/shadcn/button"

interface Row {
  id: string
  reportKey: string
  cron: string
  timezone: string
  recipients: string[]
  formats: string[]
  active: boolean
  nextRunAt: string | null
  lastRunAt: string | null
}

export function ScheduledList() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    fetch("/api/reports/scheduled")
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return
        setRows(d.data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/reports/scheduled/new">New schedule</Link>
        </Button>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-2">Report</th>
              <th className="p-2">Cron</th>
              <th className="p-2">Formats</th>
              <th className="p-2">Recipients</th>
              <th className="p-2">Next run</th>
              <th className="p-2">Status</th>
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
                  No schedules yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.reportKey}</td>
                  <td className="p-2">
                    {r.cron}{" "}
                    <span className="text-xs text-muted-foreground">({r.timezone})</span>
                  </td>
                  <td className="p-2">{r.formats.join(", ")}</td>
                  <td className="p-2">{r.recipients.join(", ") || "—"}</td>
                  <td className="p-2">
                    {r.nextRunAt ? new Date(r.nextRunAt).toLocaleString() : "—"}
                  </td>
                  <td className="p-2">{r.active ? "Active" : "Paused"}</td>
                  <td className="p-2">
                    <Link className="underline" href={`/reports/scheduled/${r.id}`}>
                      Edit
                    </Link>
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

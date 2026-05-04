"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card"

interface Row {
  id: string
  reportKey: string
  format: string
  status: string
  createdAt: string
}

export function RecentRuns() {
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    let mounted = true
    fetch("/api/reports/library?take=8")
      .then((r) => r.json())
      .then((d) => {
        if (mounted) setRows(d.data ?? [])
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Recent runs</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2"
              >
                <Link
                  className="truncate underline-offset-2 hover:underline"
                  href={`/reports/catalog/${r.reportKey}`}
                >
                  {r.reportKey}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {r.format} ·{" "}
                  {new Date(r.createdAt).toLocaleString()} ·{" "}
                  <span
                    className={
                      r.status === "FAILED"
                        ? "text-destructive"
                        : r.status === "SUCCEEDED"
                        ? "text-emerald-600"
                        : ""
                    }
                  >
                    {r.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <Link
            href="/reports/library"
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            View full library →
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

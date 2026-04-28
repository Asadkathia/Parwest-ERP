import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/shadcn/card"
import { Activity } from "lucide-react"
import type { ActivityEntry } from "@/lib/dashboard/queries"

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function OpsFeed({ entries }: { entries: ActivityEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="mb-4 flex items-start justify-between gap-4 text-sm font-semibold text-[var(--brand)] hover:underline"><div><h2 className="text-xl font-bold tracking-tight">{"Activity"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Recent system events"}</p></div><div className="flex shrink-0 items-center gap-2">{(<Link href="/audit" className="text-sm font-semibold text-[var(--brand)] hover:underline">
              View audit log
            </Link>)}</div></div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--text-muted)]">
            <Activity className="h-4 w-4" />
            No recent activity.
          </div>
        ) : (
          <ol className="space-y-3">
            {entries.map((e) => (
              <li key={e.id} className="flex items-start gap-3 text-sm">
                <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[var(--text)]">
                    <span className="font-semibold">{e.actor}</span>{" "}
                    <span className="text-[var(--text-muted)]">
                      {e.event.toLowerCase()} in {e.module.toLowerCase()}
                    </span>
                  </p>
                  {e.description ? (
                    <p className="truncate text-xs text-[var(--text-muted)]">{e.description}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-[var(--text-muted)]">{relativeTime(e.createdAt)}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

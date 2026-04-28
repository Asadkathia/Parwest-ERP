import type { AdminLogEntry } from "@/lib/admin/types"
import { Badge } from "@/components/shadcn/badge"

function severityVariantClass(severity: AdminLogEntry["severity"]) {
  if (severity === "CRITICAL") return "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-transparent"
  if (severity === "WARNING") return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-transparent"
  return "bg-secondary text-secondary-foreground border-transparent"
}

export default function SystemLogTimeline({ logs }: { logs: AdminLogEntry[] }) {
  return (
    <section className="ui-card p-4">
      <h3 className="text-sm font-semibold text-[var(--text)]">Recent System Logs</h3>
      <div className="mt-3 space-y-3">
        {logs.map((log) => (
          <article key={log.id} className="rounded-[var(--radius-md)] border border-[var(--border)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-[var(--text)]">{log.action}</p>
              <Badge className={`font-bold ${severityVariantClass(log.severity)}`}>{log.severity}</Badge>
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{log.actor} • {log.module}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{new Date(log.createdAt).toLocaleString("en-US")}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

import StatusChip from "@/components/ui/status-chip"
import type { AdminLogEntry } from "@/lib/admin/types"

function severityVariant(severity: AdminLogEntry["severity"]) {
  if (severity === "CRITICAL") return "danger"
  if (severity === "WARNING") return "warning"
  return "neutral"
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
              <StatusChip label={log.severity} variant={severityVariant(log.severity)} />
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{log.actor} • {log.module}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{new Date(log.createdAt).toLocaleString("en-US")}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

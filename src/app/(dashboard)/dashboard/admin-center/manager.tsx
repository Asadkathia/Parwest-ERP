"use client"

import { useMemo, useState } from "react"
import BroadcastComposer from "@/components/admin/BroadcastComposer"
import SystemLogTimeline from "@/components/admin/SystemLogTimeline"
import StatusChip from "@/components/ui/status-chip"
import { BroadcastMessage, seededAdminLogs, seededBroadcasts } from "@/lib/mockData"

export default function AdminCenterManager() {
  const [broadcasts, setBroadcasts] = useState(seededBroadcasts)
  const [logs, setLogs] = useState(seededAdminLogs)

  const sortedBroadcasts = useMemo(
    () => [...broadcasts].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [broadcasts]
  )

  const onCreateBroadcast = (message: BroadcastMessage) => {
    setBroadcasts((prev) => [message, ...prev])
    setLogs((prev) => [
      {
        id: `log-${crypto.randomUUID()}`,
        actor: "Admin",
        action: `Broadcast sent: ${message.title}`,
        module: "Admin Center",
        severity: "INFO",
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ])
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <BroadcastComposer onCreate={onCreateBroadcast} />

        <section className="ui-card p-4">
          <h3 className="text-sm font-semibold text-[var(--text)]">Broadcast History</h3>
          <div className="mt-3 space-y-3">
            {sortedBroadcasts.map((broadcast) => (
              <article key={broadcast.id} className="rounded-[var(--radius-md)] border border-[var(--border)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--text)]">{broadcast.title}</p>
                  <StatusChip label={broadcast.audience} variant="neutral" />
                </div>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{broadcast.message}</p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  {broadcast.createdBy} • {new Date(broadcast.createdAt).toLocaleString("en-US")}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <SystemLogTimeline logs={logs} />
    </div>
  )
}

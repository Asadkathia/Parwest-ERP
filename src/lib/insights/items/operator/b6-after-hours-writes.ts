import { registerInsight } from "@/lib/insights/registry"

registerInsight({
  key: "after-hours-writes",
  title: "B6 — After-hours writes",
  description:
    "AuditLog write events (CREATED / UPDATED / DELETED) happening outside business hours. Since the server does not persist the operator's timezone, we treat UTC hour-of-day as a proxy for Pakistan local time (PKT = UTC+5). Defaults flag writes between 10pm and 6am PKT (17:00–01:00 UTC).",
  category: "ANOMALY",
  defaultSeverity: "MEDIUM",
  defaultThresholds: {
    startHourUTC: 17,
    endHourUTC: 1,
    windowDays: 7,
  },
  thresholdDocs: {
    startHourUTC:
      "UTC hour (0-23) at which the after-hours window begins (inclusive). Default 17 = 10pm PKT.",
    endHourUTC:
      "UTC hour (0-23) at which the after-hours window ends (exclusive). Default 1 = 6am PKT. Window wraps past midnight when start > end.",
    windowDays: "How many days back to scan AuditLog (default 7).",
  },
  compute: async (ctx) => {
    const startHour = Number(ctx.thresholds.startHourUTC ?? 17)
    const endHour = Number(ctx.thresholds.endHourUTC ?? 1)
    const windowDays = Number(ctx.thresholds.windowDays ?? 7)

    const since = new Date(ctx.now.getTime() - windowDays * 24 * 60 * 60 * 1000)

    const rows = await ctx.prisma.auditLog.findMany({
      where: {
        event: { in: ["CREATED", "UPDATED", "DELETED"] },
        createdAt: { gte: since },
      },
      select: {
        userId: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    })

    const wraps = startHour > endHour
    const inWindow = (d: Date) => {
      const h = d.getUTCHours()
      return wraps ? h >= startHour || h < endHour : h >= startHour && h < endHour
    }

    const afterHours = rows.filter((r) => inWindow(r.createdAt))
    const count = afterHours.length

    if (count === 0) {
      return {
        count: 0,
        summary: `No after-hours writes in the last ${windowDays} day${windowDays === 1 ? "" : "s"}.`,
      }
    }

    const byActor = new Map<string, { name: string; count: number }>()
    for (const r of afterHours) {
      const id = r.userId ?? "unknown"
      const name = r.user?.name || r.user?.email || "Unknown user"
      const cur = byActor.get(id)
      if (cur) cur.count += 1
      else byActor.set(id, { name, count: 1 })
    }

    const items = Array.from(byActor.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([id, v]) => ({
        id,
        label: `${v.name} — ${v.count} write${v.count === 1 ? "" : "s"}`,
        sub: `Between ${startHour}:00 and ${endHour}:00 UTC`,
        href: id === "unknown" ? "/audit" : `/users/${id}`,
      }))

    return {
      count,
      summary: `${count} after-hours write${count === 1 ? "" : "s"} in the last ${windowDays} day${windowDays === 1 ? "" : "s"}.`,
      drillUrl: "/audit",
      items,
      severity: count > 200 ? "HIGH" : count > 50 ? "MEDIUM" : "LOW",
    }
  },
})

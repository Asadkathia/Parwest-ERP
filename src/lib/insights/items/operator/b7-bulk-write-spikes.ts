import { registerInsight } from "@/lib/insights/registry"

registerInsight({
  key: "bulk-write-spikes",
  title: "B7 — Bulk-write spikes",
  description:
    "Operator (userId) / 5-minute bucket pairs that contain more writes than a normal human workflow would produce — classic signal of scripted or accidental bulk edits.",
  category: "ANOMALY",
  defaultSeverity: "HIGH",
  defaultThresholds: {
    burstThreshold: 50,
    windowDays: 7,
  },
  thresholdDocs: {
    burstThreshold:
      "Minimum AuditLog write events a single user must perform inside a 5-minute bucket before the bucket is flagged as a burst (default 50).",
    windowDays: "How many days back to scan AuditLog (default 7).",
  },
  compute: async (ctx) => {
    const burstThreshold = Number(ctx.thresholds.burstThreshold ?? 50)
    const windowDays = Number(ctx.thresholds.windowDays ?? 7)
    const since = new Date(ctx.now.getTime() - windowDays * 24 * 60 * 60 * 1000)

    const rows = await ctx.prisma.auditLog.findMany({
      where: {
        event: { in: ["CREATED", "UPDATED", "DELETED"] },
        createdAt: { gte: since },
        userId: { not: null },
      },
      select: {
        userId: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    })

    type Bucket = {
      userId: string
      name: string
      bucket: number
      count: number
    }
    const buckets = new Map<string, Bucket>()
    for (const r of rows) {
      if (!r.userId) continue
      const bucket = Math.floor(r.createdAt.getTime() / 300000)
      const key = `${r.userId}|${bucket}`
      const existing = buckets.get(key)
      if (existing) existing.count += 1
      else
        buckets.set(key, {
          userId: r.userId,
          name: r.user?.name || r.user?.email || "Unknown user",
          bucket,
          count: 1,
        })
    }

    const bursts = Array.from(buckets.values()).filter((b) => b.count > burstThreshold)
    const count = bursts.length

    if (count === 0) {
      return {
        count: 0,
        summary: `No bulk-write spikes (> ${burstThreshold}/5min) in the last ${windowDays} day${windowDays === 1 ? "" : "s"}.`,
      }
    }

    const top = bursts.sort((a, b) => b.count - a.count).slice(0, 5)
    const items = top.map((b) => {
      const start = new Date(b.bucket * 300000)
      return {
        id: `${b.userId}-${b.bucket}`,
        label: `${b.name} — ${b.count} writes`,
        sub: `Starting ${start.toISOString().replace("T", " ").slice(0, 16)} UTC`,
        href: `/users/${b.userId}`,
      }
    })

    return {
      count,
      summary: `${count} bulk-write burst${count === 1 ? "" : "s"} detected in the last ${windowDays} day${windowDays === 1 ? "" : "s"}.`,
      drillUrl: "/audit",
      items,
      severity: count > 10 ? "HIGH" : "MEDIUM",
    }
  },
})

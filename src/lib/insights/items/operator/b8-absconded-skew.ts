import { registerInsight } from "@/lib/insights/registry"

registerInsight({
  key: "absconded-skew",
  title: "B8 — Absconded skew",
  description:
    "Regional offices whose share of ABSCONDED terminations is abnormally high relative to total terminations. Elevated skew can indicate mis-classification to avoid clearance/kit-return obligations.",
  category: "ANOMALY",
  defaultSeverity: "MEDIUM",
  defaultThresholds: {
    windowDays: 90,
    skewPct: 0.3,
    minTerminations: 3,
  },
  thresholdDocs: {
    windowDays: "How many days back to look at TERMINATED guards (default 90).",
    skewPct:
      "Flag offices where ABSCONDED / total terminations exceeds this ratio (default 0.3 = 30%).",
    minTerminations:
      "Minimum terminations an office needs to be evaluated — avoids false positives on tiny samples (default 3).",
  },
  compute: async (ctx) => {
    const windowDays = Number(ctx.thresholds.windowDays ?? 90)
    const skewPct = Number(ctx.thresholds.skewPct ?? 0.3)
    const minTerminations = Number(ctx.thresholds.minTerminations ?? 3)
    const since = new Date(ctx.now.getTime() - windowDays * 24 * 60 * 60 * 1000)

    const terminated = await ctx.prisma.guard.findMany({
      where: {
        lifecycleStatus: "TERMINATED",
        lifecycleStatusUpdatedAt: { gte: since },
      },
      select: {
        id: true,
        terminationReason: true,
        regionalOfficeId: true,
        regionalOffice: { select: { name: true } },
      },
    })

    if (terminated.length === 0) {
      return {
        count: 0,
        summary: `No terminations in the last ${windowDays} days.`,
      }
    }

    type Agg = { officeId: string; officeName: string; total: number; absconded: number }
    const byOffice = new Map<string, Agg>()
    for (const g of terminated) {
      const key = g.regionalOfficeId ?? "unassigned"
      const cur = byOffice.get(key) ?? {
        officeId: key,
        officeName: g.regionalOffice?.name || "Unassigned office",
        total: 0,
        absconded: 0,
      }
      cur.total += 1
      if (g.terminationReason === "ABSCONDED") cur.absconded += 1
      byOffice.set(key, cur)
    }

    const flagged = Array.from(byOffice.values()).filter(
      (o) => o.total >= minTerminations && o.absconded / o.total > skewPct,
    )

    const count = flagged.length
    if (count === 0) {
      return {
        count: 0,
        summary: `No offices exceed ${Math.round(skewPct * 100)}% ABSCONDED share.`,
      }
    }

    // Enrich with most-recent GuardStatusHistory.changedByName per office (for drill sub-text).
    // GuardStatusHistory has no FK relation declared, so we look up by guardId manually.
    const flaggedOfficeIds = new Set(
      flagged.map((o) => o.officeId).filter((id) => id !== "unassigned"),
    )
    const guardIdsInFlagged = terminated
      .filter((g) => g.regionalOfficeId && flaggedOfficeIds.has(g.regionalOfficeId))
      .map((g) => g.id)
    const guardOfficeMap = new Map<string, string>()
    for (const g of terminated) {
      if (g.regionalOfficeId) guardOfficeMap.set(g.id, g.regionalOfficeId)
    }
    const histories = guardIdsInFlagged.length
      ? await ctx.prisma.guardStatusHistory.findMany({
          where: {
            toStatus: "TERMINATED",
            createdAt: { gte: since },
            guardId: { in: guardIdsInFlagged },
          },
          orderBy: { createdAt: "desc" },
          select: { guardId: true, changedByName: true },
        })
      : []
    const latestActor = new Map<string, string>()
    for (const h of histories) {
      const oid = guardOfficeMap.get(h.guardId)
      if (!oid || latestActor.has(oid)) continue
      if (h.changedByName) latestActor.set(oid, h.changedByName)
    }

    const top = flagged
      .sort((a, b) => b.absconded / b.total - a.absconded / a.total)
      .slice(0, 5)
      .map((o) => {
        const pct = Math.round((o.absconded / o.total) * 100)
        const actor = latestActor.get(o.officeId)
        return {
          id: o.officeId,
          label: `${o.officeName} — ${pct}% (${o.absconded}/${o.total})`,
          sub: actor ? `Latest change by ${actor}` : null,
          href: "/guards?terminationReason=ABSCONDED",
        }
      })

    return {
      count,
      summary: `${count} regional office${count === 1 ? "" : "s"} with ABSCONDED share > ${Math.round(skewPct * 100)}%.`,
      drillUrl: "/guards?terminationReason=ABSCONDED",
      items: top,
      severity: count > 3 ? "HIGH" : "MEDIUM",
    }
  },
})

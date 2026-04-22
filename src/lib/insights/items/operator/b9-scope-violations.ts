import { registerInsight } from "@/lib/insights/registry"

registerInsight({
  key: "scope-violations",
  title: "B9 — Scope violations",
  description:
    "Manager-role users who modified records outside their assigned region / regional office, as reported by the enriched AuditLog target fields (targetRegionId, targetRegionalOfficeId). Expect this insight to report 0 until API writers consistently call the enriched recordAudit() helper — the fields are nullable and only recently added.",
  category: "ANOMALY",
  defaultSeverity: "HIGH",
  defaultThresholds: {
    windowDays: 30,
  },
  thresholdDocs: {
    windowDays: "How many days back to scan AuditLog (default 30).",
  },
  compute: async (ctx) => {
    const windowDays = Number(ctx.thresholds.windowDays ?? 30)
    const since = new Date(ctx.now.getTime() - windowDays * 24 * 60 * 60 * 1000)

    const rows = await ctx.prisma.auditLog.findMany({
      where: {
        createdAt: { gte: since },
        user: { role: { name: "Manager" } },
        OR: [{ targetRegionId: { not: null } }, { targetRegionalOfficeId: { not: null } }],
      },
      select: {
        id: true,
        module: true,
        createdAt: true,
        targetRegionId: true,
        targetRegionalOfficeId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            regionId: true,
            regionalOfficeId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const violations = rows.filter((r) => {
      if (!r.user) return false
      const regionMismatch =
        r.targetRegionId !== null &&
        r.user.regionId !== null &&
        r.targetRegionId !== r.user.regionId
      const officeMismatch =
        r.targetRegionalOfficeId !== null &&
        r.user.regionalOfficeId !== null &&
        r.targetRegionalOfficeId !== r.user.regionalOfficeId
      return regionMismatch || officeMismatch
    })

    const count = violations.length
    if (count === 0) {
      return {
        count: 0,
        summary: `No manager scope violations in the last ${windowDays} days.`,
      }
    }

    const items = violations.slice(0, 5).map((v) => ({
      id: v.id,
      label: `${v.user?.name || v.user?.email || "Manager"} — ${v.module}`,
      sub: `Target region ${v.targetRegionId ?? "-"} / office ${v.targetRegionalOfficeId ?? "-"}`,
      href: v.user?.id ? `/users/${v.user.id}` : "/audit",
    }))

    return {
      count,
      summary: `${count} cross-scope write${count === 1 ? "" : "s"} by Manager users in the last ${windowDays} days.`,
      drillUrl: "/audit",
      items,
      severity: count > 10 ? "HIGH" : "MEDIUM",
    }
  },
})

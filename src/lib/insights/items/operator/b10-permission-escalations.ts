import { registerInsight } from "@/lib/insights/registry"

registerInsight({
  key: "permission-escalations",
  title: "B10 — Permission escalations",
  description:
    "Users who gained one or more new module permissions (UserPermission rows) inside the window. UserPermission carries its own createdAt column — we use that directly. (Fallback: if the column were missing, we would flag users whose User.updatedAt >= windowStart and who hold at least one UserPermission row.)",
  category: "ANOMALY",
  defaultSeverity: "MEDIUM",
  defaultThresholds: {
    windowDays: 30,
  },
  thresholdDocs: {
    windowDays: "How many days back to look for newly granted permissions (default 30).",
  },
  compute: async (ctx) => {
    const windowDays = Number(ctx.thresholds.windowDays ?? 30)
    const since = new Date(ctx.now.getTime() - windowDays * 24 * 60 * 60 * 1000)

    const rows = await ctx.prisma.userPermission.findMany({
      where: { createdAt: { gte: since } },
      select: {
        userId: true,
        module: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    if (rows.length === 0) {
      return {
        count: 0,
        summary: `No new permissions granted in the last ${windowDays} days.`,
      }
    }

    type Agg = { userId: string; name: string; modules: string[] }
    const byUser = new Map<string, Agg>()
    for (const r of rows) {
      const cur = byUser.get(r.userId) ?? {
        userId: r.userId,
        name: r.user?.name || r.user?.email || "Unknown user",
        modules: [],
      }
      if (!cur.modules.includes(r.module)) cur.modules.push(r.module)
      byUser.set(r.userId, cur)
    }

    const count = byUser.size
    const items = Array.from(byUser.values())
      .sort((a, b) => b.modules.length - a.modules.length)
      .slice(0, 5)
      .map((u) => ({
        id: u.userId,
        label: `${u.name} — +${u.modules.length} module${u.modules.length === 1 ? "" : "s"}`,
        sub: u.modules.join(", "),
        href: `/users/${u.userId}`,
      }))

    return {
      count,
      summary: `${count} user${count === 1 ? "" : "s"} gained new module permissions in the last ${windowDays} days.`,
      drillUrl: "/users",
      items,
      severity: count > 5 ? "HIGH" : "MEDIUM",
    }
  },
})

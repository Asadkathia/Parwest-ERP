import { registerInsight } from "@/lib/insights/registry"

registerInsight({
  key: "duplicate-cnic",
  title: "B1 — Duplicate CNIC",
  description:
    "Guard rows sharing the same CNIC — strong signal of cross-region duplicate enrollment / ghost workforce.",
  category: "ANOMALY",
  defaultSeverity: "HIGH",
  compute: async (ctx) => {
    // Duplicates are interesting precisely when they cross regions — do NOT apply scope.
    const groups = await ctx.prisma.guard.groupBy({
      by: ["cnic"],
      where: { cnic: { not: "" } },
      _count: { cnic: true },
      having: { cnic: { _count: { gt: 1 } } },
      orderBy: { _count: { cnic: "desc" } },
    })

    const count = groups.length
    if (count === 0) {
      return { count: 0, summary: "No duplicate CNICs detected." }
    }

    const top = groups.slice(0, 5)
    const guardsByCnic = await ctx.prisma.guard.findMany({
      where: { cnic: { in: top.map((g) => g.cnic) } },
      select: { id: true, name: true, cnic: true },
    })

    const items = top.map((g) => {
      const names = guardsByCnic
        .filter((x) => x.cnic === g.cnic)
        .map((x) => x.name)
        .join(", ")
      return {
        id: g.cnic,
        label: `${g.cnic} — ${g._count.cnic} guards`,
        sub: names || null,
        href: `/guards?cnic=${encodeURIComponent(g.cnic)}`,
      }
    })

    return {
      count,
      summary: `${count} CNIC${count === 1 ? "" : "s"} appearing on multiple guard records.`,
      drillUrl: "/guards",
      items,
      severity: "HIGH",
    }
  },
})

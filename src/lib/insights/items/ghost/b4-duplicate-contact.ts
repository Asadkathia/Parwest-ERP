import { registerInsight } from "@/lib/insights/registry"

registerInsight({
  key: "duplicate-contact",
  title: "B4 — Duplicate contact",
  description:
    "Guards sharing a phone number or emergency contact — weaker signal than CNIC/bank but can surface cluster enrollments.",
  category: "ANOMALY",
  defaultSeverity: "MEDIUM",
  compute: async (ctx) => {
    const [phoneGroups, emergencyGroups] = await Promise.all([
      ctx.prisma.guard.groupBy({
        by: ["phone"],
        where: { phone: { not: null, notIn: [""] } },
        _count: { phone: true },
        having: { phone: { _count: { gt: 1 } } },
        orderBy: { _count: { phone: "desc" } },
      }),
      ctx.prisma.guard.groupBy({
        by: ["emergencyContact"],
        where: { emergencyContact: { not: null, notIn: [""] } },
        _count: { emergencyContact: true },
        having: { emergencyContact: { _count: { gt: 1 } } },
        orderBy: { _count: { emergencyContact: "desc" } },
      }),
    ])

    type Row = { kind: "phone" | "emergency"; value: string; count: number }
    const combined: Row[] = [
      ...phoneGroups
        .filter((g) => g.phone)
        .map((g) => ({
          kind: "phone" as const,
          value: g.phone as string,
          count: g._count.phone,
        })),
      ...emergencyGroups
        .filter((g) => g.emergencyContact)
        .map((g) => ({
          kind: "emergency" as const,
          value: g.emergencyContact as string,
          count: g._count.emergencyContact,
        })),
    ]

    const count = combined.length
    if (count === 0) {
      return { count: 0, summary: "No duplicate contact numbers detected." }
    }

    combined.sort((a, b) => b.count - a.count)
    const top = combined.slice(0, 5)

    const phoneValues = top.filter((t) => t.kind === "phone").map((t) => t.value)
    const emergencyValues = top.filter((t) => t.kind === "emergency").map((t) => t.value)
    const guards = await ctx.prisma.guard.findMany({
      where: {
        OR: [
          phoneValues.length ? { phone: { in: phoneValues } } : undefined,
          emergencyValues.length ? { emergencyContact: { in: emergencyValues } } : undefined,
        ].filter(Boolean) as object[],
      },
      select: { id: true, name: true, phone: true, emergencyContact: true },
    })

    const items = top.map((t) => {
      const names = guards
        .filter((g) =>
          t.kind === "phone" ? g.phone === t.value : g.emergencyContact === t.value
        )
        .map((g) => g.name)
        .join(", ")
      return {
        id: `${t.kind}:${t.value}`,
        label: `${t.kind === "phone" ? "Phone" : "Emergency"} ${t.value} — ${t.count} guards`,
        sub: names || null,
      }
    })

    return {
      count,
      summary: `${count} contact number${count === 1 ? "" : "s"} shared across multiple guards.`,
      drillUrl: "/guards",
      items,
    }
  },
})

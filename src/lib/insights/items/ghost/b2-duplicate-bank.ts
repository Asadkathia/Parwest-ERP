import { registerInsight } from "@/lib/insights/registry"

registerInsight({
  key: "duplicate-bank",
  title: "B2 — Duplicate bank account",
  description:
    "Multiple guards sharing the same bank account number or IBAN — salary funnelled to a single beneficiary.",
  category: "ANOMALY",
  defaultSeverity: "HIGH",
  compute: async (ctx) => {
    const [acctGroups, ibanGroups] = await Promise.all([
      ctx.prisma.guard.groupBy({
        by: ["bankAccountNumber"],
        where: { bankAccountNumber: { not: null, notIn: [""] } },
        _count: { bankAccountNumber: true },
        having: { bankAccountNumber: { _count: { gt: 1 } } },
        orderBy: { _count: { bankAccountNumber: "desc" } },
      }),
      ctx.prisma.guard.groupBy({
        by: ["bankIban"],
        where: { bankIban: { not: null, notIn: [""] } },
        _count: { bankIban: true },
        having: { bankIban: { _count: { gt: 1 } } },
        orderBy: { _count: { bankIban: "desc" } },
      }),
    ])

    type Row = { kind: "account" | "iban"; value: string; count: number }
    const combined: Row[] = [
      ...acctGroups
        .filter((g) => g.bankAccountNumber)
        .map((g) => ({
          kind: "account" as const,
          value: g.bankAccountNumber as string,
          count: g._count.bankAccountNumber,
        })),
      ...ibanGroups
        .filter((g) => g.bankIban)
        .map((g) => ({
          kind: "iban" as const,
          value: g.bankIban as string,
          count: g._count.bankIban,
        })),
    ]

    const count = combined.length
    if (count === 0) {
      return { count: 0, summary: "No duplicate bank accounts detected." }
    }

    combined.sort((a, b) => b.count - a.count)
    const top = combined.slice(0, 5)

    const acctValues = top.filter((t) => t.kind === "account").map((t) => t.value)
    const ibanValues = top.filter((t) => t.kind === "iban").map((t) => t.value)
    const guards = await ctx.prisma.guard.findMany({
      where: {
        OR: [
          acctValues.length ? { bankAccountNumber: { in: acctValues } } : undefined,
          ibanValues.length ? { bankIban: { in: ibanValues } } : undefined,
        ].filter(Boolean) as object[],
      },
      select: { id: true, name: true, bankAccountNumber: true, bankIban: true },
    })

    const items = top.map((t) => {
      const names = guards
        .filter((g) =>
          t.kind === "account" ? g.bankAccountNumber === t.value : g.bankIban === t.value
        )
        .map((g) => g.name)
        .join(", ")
      return {
        id: `${t.kind}:${t.value}`,
        label: `${t.kind === "iban" ? "IBAN" : "Account"} ${t.value} — ${t.count} guards`,
        sub: names || null,
      }
    })

    return {
      count,
      summary: `${count} bank identifier${count === 1 ? "" : "s"} shared across multiple guards.`,
      drillUrl: "/guards",
      items,
      severity: "HIGH",
    }
  },
})

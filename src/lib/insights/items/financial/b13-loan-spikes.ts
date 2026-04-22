import { registerInsight } from "@/lib/insights/registry"
import { buildManagerScopeWhere } from "@/lib/access/scope"

// Loan.status values observed: PENDING | FINALIZED (open). Treat any status NOT in this
// settled-list as active. Err on the side of counting open loans.
const SETTLED_STATUSES = new Set(["CLOSED", "CANCELLED", "PAID"])

registerInsight({
  key: "loan-spikes",
  title: "B13 — Loan spikes",
  description:
    "Guards carrying too many active loans, or whose total active-loan principal exceeds a multiple of their salary.",
  category: "ANOMALY",
  defaultSeverity: "MEDIUM",
  defaultThresholds: {
    maxLoans: 3,
    salaryMultiple: 2,
  },
  thresholdDocs: {
    maxLoans: "Flag guards with more than this many concurrently-active loans.",
    salaryMultiple:
      "Flag guards whose active-loan principal exceeds (this × monthly salary).",
  },
  compute: async (ctx) => {
    const maxLoans = Number(ctx.thresholds.maxLoans ?? 3)
    const salaryMultiple = Number(ctx.thresholds.salaryMultiple ?? 2)

    const loans = await ctx.prisma.loan.findMany({
      where: {
        ...buildManagerScopeWhere(ctx.scope, { regionId: "regionId" }),
      },
      select: {
        id: true,
        guardId: true,
        amount: true,
        status: true,
        guard: { select: { id: true, name: true, salary: true } },
      },
    })

    type Agg = {
      guardId: string
      guardName: string
      salary: number
      count: number
      principal: number
    }
    const byGuard = new Map<string, Agg>()

    for (const l of loans) {
      if (SETTLED_STATUSES.has((l.status || "").toUpperCase())) continue
      const agg = byGuard.get(l.guardId) ?? {
        guardId: l.guardId,
        guardName: l.guard?.name ?? "Unknown",
        salary: l.guard?.salary ?? 0,
        count: 0,
        principal: 0,
      }
      agg.count += 1
      agg.principal += l.amount || 0
      byGuard.set(l.guardId, agg)
    }

    type Offender = Agg & { reason: string; overAmount: number }
    const offenders: Offender[] = []
    for (const agg of byGuard.values()) {
      const exceedsCount = agg.count > maxLoans
      const exceedsMultiple =
        agg.salary > 0 && agg.principal > salaryMultiple * agg.salary
      if (!exceedsCount && !exceedsMultiple) continue
      const reasons: string[] = []
      if (exceedsCount) reasons.push(`${agg.count} active loans`)
      if (exceedsMultiple)
        reasons.push(
          `₨${agg.principal.toFixed(0)} > ${salaryMultiple}× salary (₨${agg.salary.toFixed(0)})`
        )
      offenders.push({
        ...agg,
        reason: reasons.join(" · "),
        overAmount:
          agg.salary > 0 ? agg.principal - salaryMultiple * agg.salary : agg.principal,
      })
    }

    const count = offenders.length
    if (count === 0) return { count: 0, summary: "No issues" }

    offenders.sort((a, b) => b.principal - a.principal)
    const items = offenders.slice(0, 5).map((o) => ({
      id: o.guardId,
      label: o.guardName,
      sub: o.reason,
      href: `/guards/${o.guardId}`,
      amount: o.principal,
    }))

    return {
      count,
      summary: `${count} guard${count === 1 ? "" : "s"} with loan spikes`,
      drillUrl: "/payroll",
      items,
    }
  },
})

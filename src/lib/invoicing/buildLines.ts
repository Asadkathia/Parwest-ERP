import { prisma } from "@/lib/db"
import { resolveContractRateContext, toRateLookup } from "@/lib/invoicing/rates"
import { selectManualScopedRate } from "@/lib/invoicing/rateSelection"
import { selectGuardRate } from "@/lib/invoicing/guardRate"
import { provinceForBranch, type Province } from "@/lib/geo/province"

export type GeneratedLineKind = "GUARD_SALARY" | "SPECIAL_DUTY"

export type GeneratedLine = {
  kind: GeneratedLineKind
  refId: string | null
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type BuildLinesResult = {
  items: GeneratedLine[]
  warnings: string[]
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export async function buildInvoiceLines(args: {
  clientId: string
  branchId: string | null
  monthStart: Date
  monthEnd: Date
  /** When set, restricts deployment & special duty windows to [monthStart, asOf). Used by daily accrual. */
  asOf?: Date
}): Promise<BuildLinesResult> {
  const items: GeneratedLine[] = []
  const warnings: string[] = []
  const upper = args.asOf && args.asOf < args.monthEnd ? args.asOf : args.monthEnd

  const specialDuties = await prisma.payrollSpecialDuty.findMany({
    where: {
      clientId: args.clientId,
      ...(args.branchId ? { branchId: args.branchId } : {}),
      status: "ACTIVE",
      dateFrom: { lt: upper },
      dateTo: { gte: args.monthStart },
    },
    include: { guard: { select: { name: true, parwestId: true } } },
  })
  for (const sd of specialDuties) {
    items.push({
      kind: "SPECIAL_DUTY",
      refId: sd.id,
      description: `Special duty: ${sd.guard.name} (${sd.guard.parwestId}) ${fmtDate(sd.dateFrom)}..${fmtDate(sd.dateTo)}`,
      quantity: sd.hours,
      unitPrice: sd.hourRate,
      lineTotal: round2(sd.hours * sd.hourRate),
    })
  }

  const deployments = await prisma.deployment.findMany({
    where: {
      clientId: args.clientId,
      ...(args.branchId ? { branchId: args.branchId } : {}),
      deploymentDate: { gte: args.monthStart, lt: upper },
    },
    select: {
      id: true,
      guardId: true,
      branchId: true,
      deploymentDate: true,
      extraHours: true,
      guard: { select: { name: true, parwestId: true, isExService: true, exServiceType: true } },
    },
  })

  type Guard = { name: string; parwestId: string; isExService: boolean | null; exServiceType: string | null }
  type Agg = {
    guard: Guard
    days: Set<string>
    latestId: string
    latestDate: Date
    latestBranchId: string | null
    otHours: number
  }
  const byGuard = new Map<string, Agg>()
  for (const d of deployments) {
    const dayKey = fmtDate(d.deploymentDate)
    let agg = byGuard.get(d.guardId)
    if (!agg) {
      agg = {
        guard: d.guard,
        days: new Set(),
        latestId: d.id,
        latestDate: d.deploymentDate,
        latestBranchId: d.branchId,
        otHours: 0,
      }
      byGuard.set(d.guardId, agg)
    }
    agg.days.add(dayKey)
    if (d.deploymentDate > agg.latestDate) {
      agg.latestDate = d.deploymentDate
      agg.latestId = d.id
      agg.latestBranchId = d.branchId
    }
    const oh = Number(d.extraHours ?? 0)
    if (oh > 0) agg.otHours += oh
  }

  // Resolve the applicable contract + its rate set once, then dispatch per-guard
  // by billing mode. MANUAL bills by location scope (branch → region → province
  // → global); DYNAMIC bills the deployed guard's own per-guard rate.
  const ctx = await resolveContractRateContext({
    clientId: args.clientId,
    branchId: args.branchId,
  })

  // MANUAL location scope (branch → region → province → global) is a property of
  // WHERE each guard is deployed, not of the contract. A branchful client is
  // region-less, so resolving region/province once from `args.branchId` collapses to
  // NULL for a client-level invoice (branchId null) and silently bypasses every
  // BRANCH/REGION/PROVINCE-scoped rate → GLOBAL-or-nothing. Resolve per the guard's
  // own deployment branch instead, memoized by branchId. (region-less billing fix)
  const branchScopeCache = new Map<string, { regionId: string | null; province: Province | null }>()
  async function resolveBranchScope(
    branchId: string | null,
  ): Promise<{ regionId: string | null; province: Province | null }> {
    const key = branchId ?? "__none__"
    const cached = branchScopeCache.get(key)
    if (cached) return cached
    const branchRow = branchId
      ? await prisma.branch.findUnique({
          where: { id: branchId },
          select: { regionalOfficeId: true },
        })
      : null
    const regionalOfficeId = branchRow?.regionalOfficeId ?? null
    // Region precedence: the branch office's region → (only when there is no branch
    // context at all, i.e. a branchless client) the client's own region.
    const office = regionalOfficeId
      ? await prisma.regionalOffice.findUnique({
          where: { id: regionalOfficeId },
          select: { regionId: true },
        })
      : null
    let regionId = office?.regionId ?? null
    if (!regionId && !branchId) {
      const client = await prisma.client.findUnique({
        where: { id: args.clientId },
        select: { regionId: true },
      })
      regionId = client?.regionId ?? null
    }
    const province = await provinceForBranch(prisma, { regionalOfficeId, clientId: args.clientId })
    const result = { regionId, province }
    branchScopeCache.set(key, result)
    return result
  }

  for (const [guardId, agg] of byGuard.entries()) {
    const days = agg.days.size
    // For a branch-level invoice use that branch; for a client-level invoice resolve
    // each guard's scope from its own deployment branch (not the null client region).
    const guardBranchId = args.branchId ?? agg.latestBranchId
    let regionId: string | null = null
    let province: Province | null = null
    if (ctx.billingMode === "MANUAL" && ctx.contractId) {
      const s = await resolveBranchScope(guardBranchId)
      regionId = s.regionId
      province = s.province
    }
    const selected =
      ctx.billingMode === "DYNAMIC"
        ? selectGuardRate(ctx.guardRates, guardId, agg.latestDate)
        : selectManualScopedRate(ctx.scopedRates, {
            branchId: guardBranchId,
            regionId,
            province,
            asOf: agg.latestDate,
          })
    const rate = toRateLookup(selected, ctx.contractId)
    if (rate.dailyRate <= 0) {
      warnings.push(
        ctx.billingMode === "DYNAMIC"
          ? `No per-guard rate for ${agg.guard.name} (${agg.guard.parwestId}) on this contract.`
          : `No contract rate for ${agg.guard.name} (${agg.guard.parwestId}) — ${province ?? "?"}/${regionId ?? "?"}.`,
      )
      continue
    }
    items.push({
      kind: "GUARD_SALARY",
      refId: agg.latestId,
      description: `Salary: ${agg.guard.name} (${agg.guard.parwestId}) — ${days} day${days === 1 ? "" : "s"} @ ${rate.dailyRate}`,
      quantity: days,
      unitPrice: rate.dailyRate,
      lineTotal: round2(days * rate.dailyRate),
    })
    if (agg.otHours > 0 && rate.overtimeHourly > 0) {
      items.push({
        kind: "GUARD_SALARY",
        refId: agg.latestId,
        description: `Overtime: ${agg.guard.name} (${agg.guard.parwestId}) — ${agg.otHours}h @ ${rate.overtimeHourly}`,
        quantity: agg.otHours,
        unitPrice: rate.overtimeHourly,
        lineTotal: round2(agg.otHours * rate.overtimeHourly),
      })
    }
  }

  return { items, warnings }
}

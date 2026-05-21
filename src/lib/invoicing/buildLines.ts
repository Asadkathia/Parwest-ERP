import { prisma } from "@/lib/db"
import { resolveContractRateContext, toRateLookup } from "@/lib/invoicing/rates"
import { resolveBillingExService, resolveBillingGeo, selectContractRate } from "@/lib/invoicing/rateSelection"

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
        otHours: 0,
      }
      byGuard.set(d.guardId, agg)
    }
    agg.days.add(dayKey)
    if (d.deploymentDate > agg.latestDate) {
      agg.latestDate = d.deploymentDate
      agg.latestId = d.id
    }
    const oh = Number(d.extraHours ?? 0)
    if (oh > 0) agg.otHours += oh
  }

  // Resolve the applicable contract + its rates once, plus billing geo.
  const { rates, contractId, contractBranchId } = await resolveContractRateContext({
    clientId: args.clientId,
    branchId: args.branchId,
  })
  const client = await prisma.client.findUnique({
    where: { id: args.clientId },
    select: { operationalProvinces: true, region: { select: { name: true } } },
  })
  const usingBranchContract = contractBranchId != null
  const branch = usingBranchContract && args.branchId
    ? await prisma.branch.findUnique({ where: { id: args.branchId }, select: { province: true, city: true } })
    : null
  const geo = resolveBillingGeo({
    hasBranch: usingBranchContract,
    branch,
    client: {
      operationalProvinces: client?.operationalProvinces ?? null,
      regionName: client?.region?.name ?? null,
    },
  })

  for (const agg of byGuard.values()) {
    const days = agg.days.size
    const exService = resolveBillingExService({
      isExService: agg.guard.isExService,
      exServiceType: agg.guard.exServiceType,
    })
    if (exService === null) {
      warnings.push(
        `Ex-service type missing for ${agg.guard.name} (${agg.guard.parwestId}) — cannot resolve a contract rate.`,
      )
      continue
    }
    const selected = selectContractRate(rates, {
      exService,
      province: geo.province,
      city: geo.city,
      asOf: agg.latestDate,
    })
    const rate = toRateLookup(selected, contractId)
    if (rate.dailyRate <= 0) {
      warnings.push(
        `No contract rate for ${agg.guard.name} (${agg.guard.parwestId}) — exService "${exService}", ${geo.province ?? "?"}/${geo.city ?? "?"}.`,
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

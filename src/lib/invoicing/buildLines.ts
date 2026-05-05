import { prisma } from "@/lib/db"
import { fromContract } from "@/lib/invoicing/rates"

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
      guardType: true,
      guard: { select: { name: true, parwestId: true } },
    },
  })

  type Agg = {
    guard: { name: string; parwestId: string }
    guardType: string | null
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
        guardType: d.guardType,
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
      if (!agg.guardType && d.guardType) agg.guardType = d.guardType
    }
    const oh = Number(d.extraHours ?? 0)
    if (oh > 0) agg.otHours += oh
  }

  for (const agg of byGuard.values()) {
    const days = agg.days.size
    const rate = await fromContract({
      clientId: args.clientId,
      branchId: args.branchId,
      guardType: agg.guardType,
      asOf: agg.latestDate,
    })
    if (rate.dailyRate <= 0) {
      warnings.push(
        `No contract rate for ${agg.guard.name} (${agg.guard.parwestId}) — guard type "${agg.guardType ?? "unknown"}".`
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

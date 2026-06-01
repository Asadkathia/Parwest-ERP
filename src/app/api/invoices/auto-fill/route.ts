import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { resolveContractRateContext, toRateLookup } from "@/lib/invoicing/rates"
import { selectManualScopedRate } from "@/lib/invoicing/rateSelection"
import { selectGuardRate } from "@/lib/invoicing/guardRate"
import { provinceForBranch, type Province } from "@/lib/geo/province"

function parseMonthStart(month: string) {
  const value = `${month}-01T00:00:00.000Z`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}
function nextMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
}
function round2(value: number) {
  return Math.round(value * 100) / 100
}
function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

type AutofillItem = {
  kind: "GUARD_SALARY" | "SPECIAL_DUTY"
  refId: string
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
  rateSource?: "CONTRACT" | "NONE"
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "CREATE")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const body = await request.json()
    const clientId = body?.clientId ? String(body.clientId) : ""
    const branchId = body?.branchId ? String(body.branchId) : null
    const monthValue = body?.month ? String(body.month) : ""
    if (!clientId || !monthValue) return badRequest("clientId and month are required.")

    const monthStart = parseMonthStart(monthValue)
    if (!monthStart) return badRequest("month must be in YYYY-MM format.")
    const monthEnd = nextMonth(monthStart)

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, regionId: true },
    })
    if (!client) return notFound("Client not found.")
    if (managerScope && managerScopeDenied(managerScope, { regionId: client.regionId })) {
      return forbidden("Forbidden: client is outside your scope.")
    }

    if (branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { id: true, clientId: true },
      })
      if (!branch || branch.clientId !== clientId) {
        return badRequest("branchId does not belong to the given client.")
      }
    }

    const warnings: string[] = []
    const items: AutofillItem[] = []

    // ── SPECIAL_DUTY ──────────────────────────────────────────────
    const specialDuties = await prisma.payrollSpecialDuty.findMany({
      where: {
        clientId,
        ...(branchId ? { branchId } : {}),
        status: "ACTIVE",
        dateFrom: { lt: monthEnd },
        dateTo: { gte: monthStart },
      },
      include: { guard: { select: { id: true, name: true, parwestId: true } } },
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

    // ── GUARD_SALARY ──────────────────────────────────────────────
    const deployments = await prisma.deployment.findMany({
      where: {
        clientId,
        ...(branchId ? { branchId } : {}),
        deploymentDate: { gte: monthStart, lt: monthEnd },
      },
      select: {
        id: true,
        guardId: true,
        deploymentDate: true,
        extraHours: true,
        guard: { select: { id: true, name: true, parwestId: true, isExService: true, exServiceType: true } },
      },
    })

    type GuardAgg = {
      guard: { id: string; name: string; parwestId: string; isExService: boolean | null; exServiceType: string | null }
      days: Set<string>
      latestDeploymentId: string
      latestDeploymentDate: Date
      overtimeHoursTotal: number
    }

    const byGuard = new Map<string, GuardAgg>()
    for (const d of deployments) {
      const dayKey = fmtDate(d.deploymentDate)
      let agg = byGuard.get(d.guardId)
      if (!agg) {
        agg = {
          guard: d.guard,
          days: new Set(),
          latestDeploymentId: d.id,
          latestDeploymentDate: d.deploymentDate,
          overtimeHoursTotal: 0,
        }
        byGuard.set(d.guardId, agg)
      }
      agg.days.add(dayKey)
      if (d.deploymentDate > agg.latestDeploymentDate) {
        agg.latestDeploymentDate = d.deploymentDate
        agg.latestDeploymentId = d.id
      }
      const oh = Number(d.extraHours ?? 0)
      if (oh > 0) agg.overtimeHoursTotal += oh
    }

    // Resolve the applicable contract + its rate set once, then dispatch per-guard
    // by billing mode. MANUAL bills by location scope (branch → region → province
    // → global); DYNAMIC bills the deployed guard's own per-guard rate.
    const ctx = await resolveContractRateContext({ clientId, branchId })

    // MANUAL location scope is identical for every guard on this (client, branch),
    // so resolve the branch's region id + province once.
    let regionId: string | null = null
    let province: Province | null = null
    if (ctx.billingMode === "MANUAL" && ctx.contractId) {
      const branchRow = branchId
        ? await prisma.branch.findUnique({
            where: { id: branchId },
            select: { regionalOfficeId: true },
          })
        : null
      const regionalOfficeId = branchRow?.regionalOfficeId ?? null
      // Region precedence: regional office's region → client's region.
      // (Branch has no direct regionId; its region is held by its regional office.)
      const office = regionalOfficeId
        ? await prisma.regionalOffice.findUnique({
            where: { id: regionalOfficeId },
            select: { regionId: true },
          })
        : null
      regionId = office?.regionId ?? client.regionId ?? null
      province = await provinceForBranch(prisma, {
        regionalOfficeId,
        clientId,
      })
    }

    for (const [guardId, agg] of byGuard.entries()) {
      const dayCount = agg.days.size
      const selected =
        ctx.billingMode === "DYNAMIC"
          ? selectGuardRate(ctx.guardRates, guardId, agg.latestDeploymentDate)
          : selectManualScopedRate(ctx.scopedRates, {
              branchId,
              regionId,
              province,
              asOf: agg.latestDeploymentDate,
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

      const lineTotal = round2(dayCount * rate.dailyRate)
      items.push({
        kind: "GUARD_SALARY",
        refId: agg.latestDeploymentId,
        description: `Salary: ${agg.guard.name} (${agg.guard.parwestId}) — ${dayCount} day${dayCount === 1 ? "" : "s"} @ ${rate.dailyRate}`,
        quantity: dayCount,
        unitPrice: rate.dailyRate,
        lineTotal,
        rateSource: rate.source,
      })

      if (agg.overtimeHoursTotal > 0) {
        if (rate.overtimeHourly > 0) {
          items.push({
            kind: "GUARD_SALARY",
            refId: agg.latestDeploymentId,
            description: `Overtime: ${agg.guard.name} (${agg.guard.parwestId}) — ${agg.overtimeHoursTotal}h @ ${rate.overtimeHourly}`,
            quantity: agg.overtimeHoursTotal,
            unitPrice: rate.overtimeHourly,
            lineTotal: round2(agg.overtimeHoursTotal * rate.overtimeHourly),
            rateSource: rate.source,
          })
        } else {
          warnings.push(
            `Overtime hours present for ${agg.guard.name} (${agg.guard.parwestId}) but the applicable contract rate has no overtime rate.`,
          )
        }
      }
    }

    const subtotal = round2(items.reduce((acc, i) => acc + i.lineTotal, 0))
    return NextResponse.json({
      items,
      warnings,
      summary: { subtotal, itemCount: items.length },
    })
  } catch (error) {
    console.error("Error in invoice auto-fill:", error)
    return internalServerError("Failed to generate auto-fill suggestions")
  }
}

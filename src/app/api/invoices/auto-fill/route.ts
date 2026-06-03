import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope } from "@/lib/access/scope"
import { clientInScope } from "@/lib/clients/access"
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
    if (managerScope && !(await clientInScope(client.id, managerScope))) {
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
        branchId: true,
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
      latestBranchId: string | null
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
          latestBranchId: d.branchId,
          overtimeHoursTotal: 0,
        }
        byGuard.set(d.guardId, agg)
      }
      agg.days.add(dayKey)
      if (d.deploymentDate > agg.latestDeploymentDate) {
        agg.latestDeploymentDate = d.deploymentDate
        agg.latestDeploymentId = d.id
        agg.latestBranchId = d.branchId
      }
      const oh = Number(d.extraHours ?? 0)
      if (oh > 0) agg.overtimeHoursTotal += oh
    }

    // Resolve the applicable contract + its rate set once, then dispatch per-guard
    // by billing mode. MANUAL bills by location scope (branch → region → province
    // → global); DYNAMIC bills the deployed guard's own per-guard rate.
    const ctx = await resolveContractRateContext({ clientId, branchId })

    // MANUAL location scope (branch → region → province → global) is a property of
    // WHERE each guard is deployed, not of the contract. A branchful client is
    // region-less, so resolving region/province once from `branchId` collapses to
    // NULL for a client-level invoice (branchId null) and silently bypasses every
    // BRANCH/REGION/PROVINCE-scoped rate → GLOBAL-or-nothing. Resolve per the guard's
    // own deployment branch instead, memoized by branchId. (region-less billing fix)
    const branchScopeCache = new Map<string, { regionId: string | null; province: Province | null }>()
    async function resolveBranchScope(
      branchScopeId: string | null,
    ): Promise<{ regionId: string | null; province: Province | null }> {
      const key = branchScopeId ?? "__none__"
      const cached = branchScopeCache.get(key)
      if (cached) return cached
      const branchRow = branchScopeId
        ? await prisma.branch.findUnique({
            where: { id: branchScopeId },
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
      let scopeRegionId = office?.regionId ?? null
      if (!scopeRegionId && !branchScopeId) {
        const clientRow = await prisma.client.findUnique({
          where: { id: clientId },
          select: { regionId: true },
        })
        scopeRegionId = clientRow?.regionId ?? null
      }
      const scopeProvince = await provinceForBranch(prisma, { regionalOfficeId, clientId })
      const result = { regionId: scopeRegionId, province: scopeProvince }
      branchScopeCache.set(key, result)
      return result
    }

    for (const [guardId, agg] of byGuard.entries()) {
      const dayCount = agg.days.size
      // For a branch-level invoice use that branch; for a client-level invoice resolve
      // each guard's scope from its own deployment branch (not the null client region).
      const guardBranchId = branchId ?? agg.latestBranchId
      let regionId: string | null = null
      let province: Province | null = null
      if (ctx.billingMode === "MANUAL" && ctx.contractId) {
        const s = await resolveBranchScope(guardBranchId)
        regionId = s.regionId
        province = s.province
      }
      const selected =
        ctx.billingMode === "DYNAMIC"
          ? selectGuardRate(ctx.guardRates, guardId, agg.latestDeploymentDate)
          : selectManualScopedRate(ctx.scopedRates, {
              branchId: guardBranchId,
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

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { fromContract } from "@/lib/invoicing/rates"

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
        guardType: true,
        guard: { select: { id: true, name: true, parwestId: true } },
      },
    })

    type GuardAgg = {
      guard: { id: string; name: string; parwestId: string }
      guardType: string | null
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
          guardType: d.guardType,
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
        if (!agg.guardType && d.guardType) agg.guardType = d.guardType
      }
      const oh = Number(d.extraHours ?? 0)
      if (oh > 0) agg.overtimeHoursTotal += oh
    }

    for (const agg of byGuard.values()) {
      const dayCount = agg.days.size
      const rate = await fromContract({
        clientId,
        branchId,
        guardType: agg.guardType,
        asOf: agg.latestDeploymentDate,
      })

      if (rate.dailyRate <= 0) {
        warnings.push(
          `No contract rate found for ${agg.guard.name} (${agg.guard.parwestId}) — add a contract rate for guard type "${agg.guardType ?? "unknown"}".`,
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
            `Overtime hours present for ${agg.guard.name} but no overtime rate in contract for guard type "${agg.guardType ?? "unknown"}".`,
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

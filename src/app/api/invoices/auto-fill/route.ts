import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

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
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")
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

    // SPECIAL_DUTY: any record overlapping the month for this client (and branch if specified)
    const specialDuties = await prisma.payrollSpecialDuty.findMany({
      where: {
        clientId,
        ...(branchId ? { branchId } : {}),
        status: "ACTIVE",
        // overlap: dateFrom < monthEnd AND dateTo >= monthStart
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

    // GUARD_SALARY: distinct guards deployed at this client (and branch) in this month
    const deployments = await prisma.deployment.findMany({
      where: {
        clientId,
        ...(branchId ? { branchId } : {}),
        deploymentDate: { gte: monthStart, lt: monthEnd },
      },
      select: {
        guardId: true,
        guard: { select: { id: true, name: true, parwestId: true } },
      },
    })

    const seenGuards = new Set<string>()
    const distinctGuards: { id: string; name: string; parwestId: string }[] = []
    for (const d of deployments) {
      if (seenGuards.has(d.guardId)) continue
      seenGuards.add(d.guardId)
      distinctGuards.push(d.guard)
    }

    if (distinctGuards.length) {
      const payrolls = await prisma.payroll.findMany({
        where: {
          guardId: { in: distinctGuards.map((g) => g.id) },
          month: { gte: monthStart, lt: monthEnd },
        },
      })
      const payrollByGuard = new Map(payrolls.map((p) => [p.guardId, p]))
      const monthLabel = monthValue

      for (const guard of distinctGuards) {
        const payroll = payrollByGuard.get(guard.id)
        if (!payroll) {
          warnings.push(`No payroll row for ${guard.name} (${guard.parwestId}) in ${monthLabel}`)
          continue
        }
        const unitPrice = payroll.netSalary || 0
        items.push({
          kind: "GUARD_SALARY",
          refId: payroll.id,
          description: `Salary: ${guard.name} (${guard.parwestId}) ${monthLabel}`,
          quantity: 1,
          unitPrice,
          lineTotal: round2(unitPrice),
        })
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

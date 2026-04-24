import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

import { parseMonthRange as parseMonth } from "@/lib/payroll/date-helpers"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "VIEW")) return forbidden("Access denied.")

    const { id: branchId } = await params
    const monthRaw = new URL(request.url).searchParams.get("month")
    if (!monthRaw) return badRequest("month is required.")
    const month = parseMonth(monthRaw)
    if (!month) return badRequest("Invalid month value.")

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: {
        client: { select: { id: true, name: true } },
      },
    })
    if (!branch) return notFound("Branch not found.")

    const [managerUser, supervisorAssignment] = await Promise.all([
      branch.assignedManagerId
        ? prisma.user.findUnique({
            where: { id: branch.assignedManagerId },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      prisma.clientSupervisorAssignment.findFirst({
        where: { branchId: branch.id, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        include: { supervisor: { select: { id: true, name: true } } },
      }),
    ])

    const deployments = await prisma.deployment.findMany({
      where: {
        branchId: branch.id,
        deploymentDate: { gte: month.start, lt: month.end },
      },
      include: {
        guard: {
          select: {
            id: true,
            parwestId: true,
            name: true,
          },
        },
      },
    })

    // Aggregate per guard. Every deployment row contributes its rate to basePay
    // regardless of deploymentType. Overtime is a separate hourly mechanism
    // (Wave 2) and does not affect this calculation.
    type GuardRow = {
      guardId: string
      parwestId: string
      guardName: string
      guardType: string | null
      isExtraGuard: boolean
      basePay: number          // sum of dep.salary ?? dep.rate over all deployment rows
      uniqueDays: Set<string>  // for display only
    }
    const byGuard = new Map<string, GuardRow>()

    for (const dep of deployments) {
      if (!byGuard.has(dep.guardId)) {
        byGuard.set(dep.guardId, {
          guardId: dep.guardId,
          parwestId: dep.guard.parwestId,
          guardName: dep.guard.name,
          guardType: dep.guardType,
          isExtraGuard: dep.isExtraGuard,
          basePay: 0,
          uniqueDays: new Set(),
        })
      }
      const row = byGuard.get(dep.guardId)!
      row.basePay += Number(dep.salary ?? dep.rate ?? 0)
      row.uniqueDays.add(dep.deploymentDate.toISOString().slice(0, 10))
    }

    const guardIds = Array.from(byGuard.keys())
    const payrollRows = await prisma.payroll.findMany({
      where: {
        guardId: { in: guardIds },
        month: { gte: month.start, lt: month.end },
        year: month.year,
      },
      select: {
        guardId: true,
        loans: true,
        netSalary: true,
      },
    })
    const payrollByGuard = new Map(payrollRows.map((p) => [p.guardId, p]))

    const guards = Array.from(byGuard.values()).map((g, i) => {
      const totalDays = g.uniqueDays.size
      const grossPay = g.basePay  // overtime/extras come from Payroll row in Wave 2
      const payroll = payrollByGuard.get(g.guardId)
      const loanDeduction = Number(payroll?.loans ?? 0)
      const netPayable = Number(payroll?.netSalary ?? grossPay - loanDeduction)
      return {
        sr: i + 1,
        guardId: g.guardId,
        parwestId: g.parwestId,
        guardName: g.guardName,
        guardType: g.guardType,
        extraGuard: g.isExtraGuard,
        totalDays,
        basePay: Number(g.basePay.toFixed(0)),
        grossPay: Number(grossPay.toFixed(0)),
        loanDeduction: Number(loanDeduction.toFixed(0)),
        netPayable: Number(netPayable.toFixed(0)),
      }
    })

    const totalBranchSalary = guards.reduce((sum, g) => sum + g.netPayable, 0)

    return NextResponse.json({
      branch: {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        clientName: branch.client?.name ?? "—",
      },
      month: month.start.toISOString().slice(0, 7),
      manager: managerUser ? { id: managerUser.id, name: managerUser.name } : null,
      supervisor: supervisorAssignment?.supervisor
        ? { id: supervisorAssignment.supervisor.id, name: supervisorAssignment.supervisor.name }
        : null,
      totalBranchSalary: Number(totalBranchSalary.toFixed(0)),
      guards,
    })
  } catch (error) {
    console.error("Error building branch detail:", error)
    return internalServerError("Failed to build branch detail.")
  }
}

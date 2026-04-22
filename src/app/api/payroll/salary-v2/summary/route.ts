import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

import { parseMonthRange as parseMonth } from "@/lib/payroll/date-helpers"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")
    const scope = deriveManagerScope(session)

    const { searchParams } = new URL(request.url)
    const monthRaw = searchParams.get("month")
    const regionalOfficeId = searchParams.get("regionalOfficeId") || undefined
    const clientId = searchParams.get("clientId") || undefined

    if (!monthRaw) return badRequest("month is required (YYYY-MM).")
    const month = parseMonth(monthRaw)
    if (!month) return badRequest("Invalid month value.")

    const deploymentWhere: Prisma.DeploymentWhereInput = {
      deploymentDate: { gte: month.start, lt: month.end },
    }
    if (clientId) deploymentWhere.clientId = clientId
    if (regionalOfficeId) deploymentWhere.regionalOfficeId = regionalOfficeId
    if (scope?.regionalOfficeIds.length) {
      deploymentWhere.regionalOfficeId = { in: scope.regionalOfficeIds }
    }
    if (scope?.regionId) {
      deploymentWhere.guard = { is: { regionId: scope.regionId } }
    }

    const [deployments, payrollRows] = await Promise.all([
      prisma.deployment.findMany({
        where: deploymentWhere,
        select: {
          id: true,
          guardId: true,
          branchId: true,
          clientId: true,
          regionalOfficeId: true,
          salary: true,
          rate: true,
          overtime: true,
          guardType: true,
          isExtraGuard: true,
          deploymentDate: true,
          deploymentType: true,
          branch: { select: { id: true, name: true, code: true, clientId: true } },
          client: { select: { id: true, name: true, assignedManagerId: true } },
          regionalOffice: { select: { id: true, name: true } },
          guard: { select: { id: true } },
        },
      }),
      prisma.payroll.findMany({
        where: {
          month: { gte: month.start, lt: month.end },
          year: month.year,
        },
        select: {
          guardId: true,
          netSalary: true,
          baseSalary: true,
        },
      }),
    ])

    // Aggregate by branch
    type BranchRow = {
      branchId: string | null
      branchCode: string | null
      branchName: string
      clientId: string | null
      clientName: string
      regionalOfficeId: string | null
      regionName: string
      deployGuards: Set<string>
      extraGuards: number
      totalSalary: number
      managerId: string | null
    }

    const branchMap = new Map<string, BranchRow>()
    const guardByType = { Civilian: 0, Army: 0, Other: 0 }
    const guardRateSum = { Civilian: { total: 0, count: 0 }, Army: { total: 0, count: 0 } }
    const uniqueClients = new Set<string>()
    const uniqueBranches = new Set<string>()
    const uniqueGuards = new Set<string>()
    const uniqueDays = new Map<string, Set<string>>() // guardId → dates

    // Per-(branch, guard) base pay accumulator. Used after the main loop to compute
    // per-branch totalSalary correctly (using netSalary if a Payroll row exists).
    const branchGuards = new Map<string, Map<string, number>>() // branchKey → guardId → branchBasePay

    const payrollByGuard = new Map(payrollRows.map((p) => [p.guardId, p]))

    for (const dep of deployments) {
      const key = dep.branchId ?? dep.clientId ?? "unassigned"
      if (!branchMap.has(key)) {
        branchMap.set(key, {
          branchId: dep.branchId,
          branchCode: dep.branch?.code ?? null,
          branchName: dep.branch?.name ?? "—",
          clientId: dep.clientId,
          clientName: dep.client?.name ?? "—",
          regionalOfficeId: dep.regionalOfficeId,
          regionName: dep.regionalOffice?.name ?? "—",
          deployGuards: new Set(),
          extraGuards: 0,
          totalSalary: 0,
          managerId: dep.client?.assignedManagerId ?? null,
        })
      }
      const row = branchMap.get(key)!
      row.deployGuards.add(dep.guardId)
      if (dep.isExtraGuard) row.extraGuards += 1

      if (dep.clientId) uniqueClients.add(dep.clientId)
      if (dep.branchId) uniqueBranches.add(dep.branchId)
      uniqueGuards.add(dep.guardId)

      if (!uniqueDays.has(dep.guardId)) uniqueDays.set(dep.guardId, new Set())
      uniqueDays.get(dep.guardId)!.add(dep.deploymentDate.toISOString().slice(0, 10))

      // Track per (branch, guard) base pay
      if (!branchGuards.has(key)) branchGuards.set(key, new Map())
      const guardMap = branchGuards.get(key)!
      guardMap.set(dep.guardId, (guardMap.get(dep.guardId) ?? 0) + Number(dep.salary ?? dep.rate ?? 0))
    }

    // Aggregate guard-level metadata once per unique guard (avoid double-counting
    // guards that appear in multiple deployment rows).
    const seenGuards = new Set<string>()
    const guardTypeByGuard = new Map<string, string>()
    const guardRateByGuard = new Map<string, number>()
    for (const dep of deployments) {
      if (!seenGuards.has(dep.guardId)) {
        seenGuards.add(dep.guardId)
        guardTypeByGuard.set(dep.guardId, dep.guardType ?? "Other")
        guardRateByGuard.set(dep.guardId, Number(dep.salary ?? dep.rate ?? 0))
      }
    }
    for (const [gId, type] of guardTypeByGuard) {
      const bucket: keyof typeof guardByType =
        type.toLowerCase() === "civilian"
          ? "Civilian"
          : type.toLowerCase().includes("army")
            ? "Army"
            : "Other"
      guardByType[bucket] += 1
      if (bucket === "Civilian" || bucket === "Army") {
        guardRateSum[bucket].total += guardRateByGuard.get(gId) ?? 0
        guardRateSum[bucket].count += 1
      }
    }

    // After loop: compute per-branch totalSalary from the (branch, guard) accumulator.
    // NOTE: per-branch totalSalary uses guard's full netSalary when row exists; for cross-region
    // totals see summary.totalSalary which de-dupes by guard.
    for (const [key, row] of branchMap) {
      const guardMap = branchGuards.get(key)
      if (!guardMap) continue
      let total = 0
      for (const [gId, branchBase] of guardMap) {
        const payroll = payrollByGuard.get(gId)
        total += payroll ? Number(payroll.netSalary || 0) : branchBase
      }
      row.totalSalary = total
    }

    const totalDays = Array.from(uniqueDays.values()).reduce((sum, set) => sum + set.size, 0)

    const branches = Array.from(branchMap.values()).map((b, i) => ({
      sr: i + 1,
      branchId: b.branchId,
      branchCode: b.branchCode,
      branchName: b.branchName,
      clientId: b.clientId,
      clientName: b.clientName,
      region: b.regionName,
      deployGuards: b.deployGuards.size,
      extraGuards: b.extraGuards,
      totalSalary: Number(b.totalSalary.toFixed(0)),
      managerId: b.managerId,
    }))

    // Company-wide totalSalary de-duped by guard: use Payroll.netSalary when present,
    // else sum of basePay across all branches that guard worked at.
    let totalSalary = 0
    for (const gId of uniqueGuards) {
      const payroll = payrollByGuard.get(gId)
      if (payroll) {
        totalSalary += Number(payroll.netSalary || 0)
      } else {
        let guardBase = 0
        for (const guardMap of branchGuards.values()) {
          guardBase += guardMap.get(gId) ?? 0
        }
        totalSalary += guardBase
      }
    }

    return NextResponse.json({
      month: month.start.toISOString().slice(0, 7),
      summary: {
        activeClients: uniqueClients.size,
        totalLocations: uniqueBranches.size,
        totalGuards: uniqueGuards.size,
        totalSalary: Number(totalSalary.toFixed(0)),
      },
      guardsByType: guardByType,
      avgSalaryRates: {
        Civilian: guardRateSum.Civilian.count > 0
          ? Number((guardRateSum.Civilian.total / guardRateSum.Civilian.count).toFixed(0))
          : 0,
        Army: guardRateSum.Army.count > 0
          ? Number((guardRateSum.Army.total / guardRateSum.Army.count).toFixed(0))
          : 0,
      },
      attendanceStats: {
        totalDays,
        // regular/overtime/extra day breakdown removed - meaningless under additive deployment-row model
        regularDays: 0,
        overtimeDays: 0,
        extraDays: 0,
      },
      branches,
    })
  } catch (error) {
    console.error("Error building salary v2 summary:", error)
    return internalServerError("Failed to build summary.")
  }
}

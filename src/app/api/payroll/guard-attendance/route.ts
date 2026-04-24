import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

import { parseMonthRange as monthRange } from "@/lib/payroll/date-helpers"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "VIEW")) return forbidden("Access denied.")

    const { searchParams } = new URL(request.url)
    const guardId = searchParams.get("guardId")
    const month = searchParams.get("month")

    if (!guardId || !month) return badRequest("guardId and month are required.")
    const range = monthRange(month)
    if (!range) return badRequest("Invalid month value.")

    const deployments = await prisma.deployment.findMany({
      where: {
        guardId,
        deploymentDate: { gte: range.start, lt: range.end },
      },
      select: {
        branchId: true,
        branch: { select: { id: true, name: true } },
        salary: true,
        rate: true,
        overtime: true,
        deploymentDate: true,
        deploymentType: true,
      },
    })

    type Row = {
      branchId: string | null
      branchName: string
      salaryRate: number
      overtimeRate: number
      regularDays: number
      regularTotal: number
      overtimeDays: number
      overtimeTotal: number
    }

    const byBranch = new Map<string, Row>()
    const dayKey = (d: Date) => d.toISOString().slice(0, 10)

    for (const dep of deployments) {
      const key = dep.branchId ?? "no-branch"
      if (!byBranch.has(key)) {
        byBranch.set(key, {
          branchId: dep.branchId,
          branchName: dep.branch?.name ?? "—",
          salaryRate: Number(dep.salary ?? dep.rate ?? 0),
          overtimeRate: Number(dep.overtime ?? 0),
          regularDays: 0,
          regularTotal: 0,
          overtimeDays: 0,
          overtimeTotal: 0,
        })
      }
      const row = byBranch.get(key)!
      const amount = Number(dep.salary ?? dep.rate ?? 0)
      if (dep.deploymentType === "OVERTIME") {
        row.overtimeDays += 1
        row.overtimeTotal += Number(dep.overtime ?? 0)
      } else {
        row.regularDays += 1
        row.regularTotal += amount
      }
    }

    // Dedupe days per branch (multiple deployments same day shouldn't double-count)
    // Re-count unique days
    const dedupMap = new Map<string, Set<string>>()
    for (const dep of deployments) {
      const key = dep.branchId ?? "no-branch"
      if (!dedupMap.has(key)) dedupMap.set(key, new Set())
      dedupMap.get(key)!.add(dayKey(dep.deploymentDate))
    }

    const rows: Row[] = Array.from(byBranch.entries()).map(([key, r]) => {
      const uniqueDays = dedupMap.get(key)?.size ?? r.regularDays
      const regularDays = Math.min(r.regularDays, uniqueDays)
      const regularTotal = r.salaryRate * regularDays
      return { ...r, regularDays, regularTotal }
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching guard attendance:", error)
    return internalServerError("Failed to fetch attendance.")
  }
}

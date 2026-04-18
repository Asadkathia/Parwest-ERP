import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"

import { parseMonthRange as parseMonth } from "@/lib/payroll/date-helpers"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const scope = deriveManagerScope(session)

    const body = await request.json()
    const month = parseMonth(String(body.month || ""))
    if (!month) return badRequest("Valid month required (YYYY-MM).")

    const regionId = body.regionId ? String(body.regionId) : null

    // Regional users must operate within their scope
    if (scope?.regionId && regionId && regionId !== scope.regionId) {
      return forbidden("Forbidden: region is outside your scope.")
    }

    const where: Prisma.LoanWhereInput = {
      status: "PENDING",
      month: { gte: month.start, lt: month.end },
    }

    if (regionId) {
      where.OR = [
        { regionId },
        { regionId: null, guard: { is: { regionId } } },
      ]
    } else if (scope?.regionId) {
      where.OR = [
        { regionId: scope.regionId },
        { regionId: null, guard: { is: { regionId: scope.regionId } } },
      ]
    }

    const pending = await prisma.loan.findMany({
      where,
      select: { id: true, amount: true, regionId: true, guard: { select: { regionId: true, region: { select: { name: true } } } } },
    })

    if (pending.length === 0) {
      return NextResponse.json({ finalized: 0, message: "No pending loans in the selected month/region." })
    }

    const ids = pending.map((l) => l.id)
    const totalAmount = pending.reduce((sum, l) => sum + Number(l.amount || 0), 0)
    const resolvedRegionId = regionId ?? pending[0].guard?.regionId ?? null
    const resolvedRegionName = pending[0].guard?.region?.name ?? null

    const userId = session.user?.id ?? "unknown"
    const userName = (session.user as { name?: string })?.name ?? (session.user as { email?: string })?.email ?? "unknown"
    const now = new Date()

    await prisma.$transaction([
      prisma.loan.updateMany({
        where: { id: { in: ids } },
        data: { status: "FINALIZED", finalizedAt: now, finalizedById: userId },
      }),
      prisma.payrollLoanFinalizationHistory.create({
        data: {
          finalizedById: userId,
          finalizedByName: userName,
          regionId: resolvedRegionId,
          regionName: resolvedRegionName,
          month: month.start,
          loanCount: ids.length,
          totalAmount,
          loanIdsJson: JSON.stringify(ids),
        },
      }),
    ])

    return NextResponse.json({
      finalized: ids.length,
      totalAmount,
      month: month.start.toISOString(),
      regionId: resolvedRegionId,
    })
  } catch (error) {
    console.error("Error finalizing loans:", error)
    return internalServerError("Failed to finalize loans.")
  }
}

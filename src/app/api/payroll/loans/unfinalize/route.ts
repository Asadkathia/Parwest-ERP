import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

import { parseMonthRange as parseMonth } from "@/lib/payroll/date-helpers"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")
    const scope = deriveManagerScope(session)

    const body = await request.json()
    const month = parseMonth(String(body.month || ""))
    if (!month) return badRequest("Valid month required (YYYY-MM).")

    const regionId = body.regionId ? String(body.regionId) : null
    if (scope?.regionId && regionId && regionId !== scope.regionId) {
      return forbidden("Forbidden: region is outside your scope.")
    }

    const where: Prisma.LoanWhereInput = {
      status: "FINALIZED",
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

    const reverted = await prisma.loan.updateMany({
      where,
      data: { status: "PENDING", finalizedAt: null, finalizedById: null },
    })

    return NextResponse.json({ reverted: reverted.count })
  } catch (error) {
    console.error("Error unfinalizing loans:", error)
    return internalServerError("Failed to unfinalize loans.")
  }
}

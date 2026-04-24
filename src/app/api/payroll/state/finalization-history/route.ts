/**
 * GET /api/payroll/state/finalization-history
 *
 * Lists PayrollSalaryFinalizationHistory snapshots (REGION lock + GLOBAL
 * finalize events). Supports filters: month, scope, regionId. Manager-scoped
 * callers are restricted to their own region.
 */

import { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  badRequest,
  forbidden,
  internalServerError,
  ok,
  unauthorized,
} from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { deriveManagerScope } from "@/lib/access/scope"
import { parseMonthRange } from "@/lib/payroll/date-helpers"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "VIEW")) return forbidden("Access denied.")

    const params = request.nextUrl.searchParams
    const monthRaw = params.get("month")
    const scopeFilter = params.get("scope")
    const regionId = params.get("regionId")

    const where: Prisma.PayrollSalaryFinalizationHistoryWhereInput = {}

    if (monthRaw) {
      const month = parseMonthRange(monthRaw)
      if (!month) return badRequest("Invalid month (expected YYYY-MM).")
      where.month = { gte: month.start, lt: month.end }
    }

    if (scopeFilter) {
      const value = scopeFilter.toUpperCase()
      if (value !== "REGION" && value !== "GLOBAL") {
        return badRequest("scope must be REGION or GLOBAL.")
      }
      where.scope = value
    }

    const callerScope = deriveManagerScope(session)
    if (regionId) {
      if (
        callerScope?.regionId &&
        callerScope.regionId !== regionId
      ) {
        return forbidden("Region is outside your scope.")
      }
      where.regionId = regionId
    } else if (callerScope?.regionId) {
      // Manager: clamp to their region. GLOBAL events have regionId=null;
      // include those as informational rows alongside their own region.
      where.OR = [{ regionId: callerScope.regionId }, { regionId: null }]
    }

    const records = await prisma.payrollSalaryFinalizationHistory.findMany({
      where,
      orderBy: { finalizedAt: "desc" },
      take: 200,
    })

    return ok({ records })
  } catch (error) {
    console.error("finalization-history fetch failed:", error)
    return internalServerError("Failed to fetch finalization history.")
  }
}

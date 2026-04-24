/**
 * GET /api/payroll/reserve/ledger?guardId=...
 *
 * Returns the most recent PayrollReserveLedger entries for a guard plus the
 * computed balance (Σ ACCRUED − Σ RELEASED). Limited to 500 rows.
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  badRequest,
  forbidden,
  internalServerError,
  notFound,
  ok,
  unauthorized,
} from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "VIEW")) return forbidden("Access denied.")

    const guardId = request.nextUrl.searchParams.get("guardId") ?? ""
    if (!guardId) return badRequest("guardId is required.")

    const guard = await prisma.guard.findUnique({
      where: { id: guardId },
      select: { id: true, regionId: true, regionalOfficeId: true },
    })
    if (!guard) return notFound("Guard not found.")

    const scope = deriveManagerScope(session)
    if (
      managerScopeDenied(scope, {
        regionId: guard.regionId ?? undefined,
        regionalOfficeId: guard.regionalOfficeId ?? undefined,
      })
    ) {
      return forbidden("This guard is outside your scope.")
    }

    const [entries, sums] = await Promise.all([
      prisma.payrollReserveLedger.findMany({
        where: { guardId },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.payrollReserveLedger.groupBy({
        by: ["type"],
        where: { guardId },
        _sum: { amount: true },
      }),
    ])

    let totalAccrued = 0
    let totalReleased = 0
    for (const row of sums) {
      const v = Number(row._sum.amount ?? 0)
      if (row.type === "ACCRUED") totalAccrued += v
      else if (row.type === "RELEASED") totalReleased += v
    }

    return ok({
      guardId,
      balance: totalAccrued - totalReleased,
      totalAccrued,
      totalReleased,
      entries,
    })
  } catch (error) {
    console.error("reserve ledger fetch failed:", error)
    return internalServerError("Failed to fetch reserve ledger.")
  }
}

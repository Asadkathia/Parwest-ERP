import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope } from "@/lib/access/scope"
import { forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")
    const scope = deriveManagerScope(session)

    const rows = await prisma.payrollLoanFinalizationHistory.findMany({
      where: scope?.regionId ? { regionId: scope.regionId } : undefined,
      orderBy: { finalizedAt: "desc" },
      take: 500,
    })

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        finalizedAt: r.finalizedAt.toISOString(),
        finalizedByName: r.finalizedByName,
        regionName: r.regionName,
        month: r.month.toISOString(),
        loanCount: r.loanCount,
        totalAmount: r.totalAmount,
      }))
    )
  } catch (error) {
    console.error("Error fetching finalize history:", error)
    return internalServerError("Failed to fetch finalize history.")
  }
}

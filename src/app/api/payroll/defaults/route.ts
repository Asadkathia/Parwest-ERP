import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")

    const rows = await prisma.payrollDefault.findMany({
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching payroll defaults:", error)
    return internalServerError("Failed to fetch defaults.")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")

    const body = await request.json()
    const regionalOfficeId = body.regionalOfficeId ? String(body.regionalOfficeId) : null
    const trainingSchoolFeeTotal = Number(body.trainingSchoolFeeTotal ?? 0)
    const trainingSchoolFeeMonthly = Number(body.trainingSchoolFeeMonthly ?? 0)
    const cwfDeduction = Number(body.cwfDeduction ?? 0)
    const spBrVerAgeLimit = body.spBrVerAgeLimit != null ? Number(body.spBrVerAgeLimit) : null
    const spBrVerDays = body.spBrVerDays != null ? Number(body.spBrVerDays) : null
    const spBrVerAmount = body.spBrVerAmount != null ? Number(body.spBrVerAmount) : null

    if (
      ![trainingSchoolFeeTotal, trainingSchoolFeeMonthly, cwfDeduction].every((n) =>
        Number.isFinite(n)
      )
    ) {
      return badRequest("All amount fields must be numeric.")
    }

    const userName =
      (session.user as { name?: string })?.name ?? (session.user as { email?: string })?.email ?? null

    const created = await prisma.payrollDefault.create({
      data: {
        regionalOfficeId,
        trainingSchoolFeeTotal,
        trainingSchoolFeeMonthly,
        cwfDeduction,
        spBrVerAgeLimit,
        spBrVerDays,
        spBrVerAmount,
        createdById: session.user?.id ?? null,
        createdByName: userName,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("Error creating payroll default:", error)
    return internalServerError("Failed to create default.")
  }
}

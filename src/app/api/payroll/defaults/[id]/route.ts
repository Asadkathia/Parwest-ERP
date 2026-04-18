import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { internalServerError, notFound, unauthorized } from "@/lib/api/response"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id } = await params
    const body = await request.json()

    const data: Record<string, unknown> = {}
    if (body.regionalOfficeId !== undefined)
      data.regionalOfficeId = body.regionalOfficeId ? String(body.regionalOfficeId) : null
    if (body.trainingSchoolFeeTotal !== undefined)
      data.trainingSchoolFeeTotal = Number(body.trainingSchoolFeeTotal)
    if (body.trainingSchoolFeeMonthly !== undefined)
      data.trainingSchoolFeeMonthly = Number(body.trainingSchoolFeeMonthly)
    if (body.cwfDeduction !== undefined) data.cwfDeduction = Number(body.cwfDeduction)
    if (body.spBrVerAgeLimit !== undefined)
      data.spBrVerAgeLimit = body.spBrVerAgeLimit != null ? Number(body.spBrVerAgeLimit) : null
    if (body.spBrVerDays !== undefined)
      data.spBrVerDays = body.spBrVerDays != null ? Number(body.spBrVerDays) : null
    if (body.spBrVerAmount !== undefined)
      data.spBrVerAmount = body.spBrVerAmount != null ? Number(body.spBrVerAmount) : null

    const updated = await prisma.payrollDefault.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") return notFound("Default not found.")
    console.error("Error updating payroll default:", error)
    return internalServerError("Failed to update default.")
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const { id } = await params
    await prisma.payrollDefault.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") return notFound("Default not found.")
    console.error("Error deleting payroll default:", error)
    return internalServerError("Failed to delete default.")
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { calculatePayrollNetSalary } from "@/lib/payroll/netSalary"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.payroll.findUnique({
      where: { id },
      select: {
        id: true,
        baseSalary: true,
        extraHoursAmount: true,
        loans: true,
        otherDeductions: true,
        trainingSchoolFees: true,
        cwf: true,
        eobi: true,
        essi: true,
        guard: { select: { regionId: true, regionalOfficeId: true } },
      },
    })

    if (!existing) return notFound("Payroll record not found.")
    if (
      managerScope &&
      managerScopeDenied(managerScope, {
        regionId: existing.guard?.regionId ?? null,
        regionalOfficeId: existing.guard?.regionalOfficeId ?? null,
      })
    ) {
      return forbidden("Forbidden: record is outside your scope.")
    }

    const hours = body.hours != null ? Number(body.hours) : undefined
    const rate = body.rate != null ? Number(body.rate) : undefined

    const updateData: Record<string, unknown> = {}
    if (hours !== undefined) updateData.specialDutyHours = hours
    if (hours !== undefined && rate !== undefined) {
      const amount = Number((hours * rate).toFixed(2))
      updateData.specialDutyAmount = amount
      updateData.netSalary = calculatePayrollNetSalary({
        baseSalary: existing.baseSalary ?? 0,
        extraHoursAmount: existing.extraHoursAmount ?? 0,
        specialDutyAmount: amount,
        loans: existing.loans ?? 0,
        otherDeductions: existing.otherDeductions ?? 0,
        trainingSchoolFees: existing.trainingSchoolFees ?? 0,
        cwf: existing.cwf ?? 0,
        eobi: existing.eobi ?? 0,
        essi: existing.essi ?? 0,
      })
    }

    if (Object.keys(updateData).length === 0) {
      return badRequest("No updatable fields provided.")
    }

    const updated = await prisma.payroll.update({
      where: { id },
      data: updateData,
      include: { guard: { select: { id: true, name: true, parwestId: true } } },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating special duty:", error)
    return internalServerError("Failed to update special duty.")
  }
}

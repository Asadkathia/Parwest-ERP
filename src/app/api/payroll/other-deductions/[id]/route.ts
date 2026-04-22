import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { calculatePayrollNetSalary } from "@/lib/payroll/netSalary"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
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
    const nextOtherDeductions = body.amount != null ? Number(body.amount) : undefined

    const existing = await prisma.payroll.findUnique({
      where: { id },
      select: {
        id: true,
        guard: {
          select: {
            regionId: true,
            regionalOfficeId: true,
          },
        },
        baseSalary: true,
        extraHoursAmount: true,
        specialDutyAmount: true,
        loans: true,
        otherDeductions: true,
        trainingSchoolFees: true,
        cwf: true,
        eobi: true,
        essi: true,
      },
    })

    if (!existing) {
      return notFound("Payroll row not found.")
    }
    if (
      managerScope &&
      managerScopeDenied(managerScope, {
        regionId: existing.guard?.regionId || null,
        regionalOfficeId: existing.guard?.regionalOfficeId || null,
      })
    ) {
      return forbidden("Forbidden: payroll row is outside your scope.")
    }

    const netSalary = calculatePayrollNetSalary({
      baseSalary: existing.baseSalary,
      extraHoursAmount: existing.extraHoursAmount,
      specialDutyAmount: existing.specialDutyAmount,
      loans: existing.loans,
      otherDeductions: nextOtherDeductions ?? existing.otherDeductions,
      trainingSchoolFees: existing.trainingSchoolFees,
      cwf: existing.cwf,
      eobi: existing.eobi,
      essi: existing.essi,
    })

    const updated = await prisma.payroll.update({
      where: { id },
      data: {
        otherDeductions: nextOtherDeductions,
        netSalary,
      },
      include: {
        guard: {
          select: { id: true, name: true, parwestId: true },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating other deductions:", error)
    return internalServerError("Failed to update other deductions.")
  }
}

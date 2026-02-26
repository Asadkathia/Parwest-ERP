import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { calculatePayrollNetSalary } from "@/lib/payroll/netSalary"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
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
      return NextResponse.json({ message: "Payroll row not found." }, { status: 404 })
    }
    if (
      managerScope &&
      managerScopeDenied(managerScope, {
        regionId: existing.guard?.regionId || null,
        regionalOfficeId: existing.guard?.regionalOfficeId || null,
      })
    ) {
      return NextResponse.json({ message: "Forbidden: payroll row is outside your scope." }, { status: 403 })
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
    return NextResponse.json({ message: "Failed to update other deductions." }, { status: 500 })
  }
}

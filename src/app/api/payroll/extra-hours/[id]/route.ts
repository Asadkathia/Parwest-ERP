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

    const hours = body.hours != null ? Number(body.hours) : undefined
    const rate = body.rate != null ? Number(body.rate) : undefined
    const computedAmount =
      hours != null && rate != null ? Number((hours * rate).toFixed(2)) : undefined

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

    const nextExtraHoursAmount = computedAmount ?? (body.amount != null ? Number(body.amount) : existing.extraHoursAmount)
    const netSalary = calculatePayrollNetSalary({
      baseSalary: existing.baseSalary,
      extraHoursAmount: nextExtraHoursAmount,
      specialDutyAmount: existing.specialDutyAmount,
      loans: existing.loans,
      otherDeductions: existing.otherDeductions,
      trainingSchoolFees: existing.trainingSchoolFees,
      cwf: existing.cwf,
      eobi: existing.eobi,
      essi: existing.essi,
    })

    const updated = await prisma.payroll.update({
      where: { id },
      data: {
        extraHours: hours,
        extraHoursAmount: nextExtraHoursAmount,
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
    console.error("Error updating extra hours:", error)
    return NextResponse.json({ message: "Failed to update extra hours." }, { status: 500 })
  }
}

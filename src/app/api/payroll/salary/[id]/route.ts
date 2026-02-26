import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
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

    const updated = await prisma.payroll.update({
      where: { id },
      data: {
        paymentStatus: body.paymentStatus ? String(body.paymentStatus) : undefined,
        paymentMethod: body.paymentMethod !== undefined ? (body.paymentMethod ? String(body.paymentMethod) : null) : undefined,
      },
      include: {
        guard: { select: { id: true, name: true, parwestId: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    if (String(error?.code) === "P2025") {
      return NextResponse.json({ message: "Payroll row not found." }, { status: 404 })
    }
    console.error("Error updating payroll salary row:", error)
    return NextResponse.json({ message: "Failed to update payroll row." }, { status: 500 })
  }
}

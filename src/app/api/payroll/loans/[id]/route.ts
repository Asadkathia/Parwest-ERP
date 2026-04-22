import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return unauthorized()
    }
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.loan.findUnique({
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
      return notFound("Loan not found.")
    }
    if (
      managerScope &&
      managerScopeDenied(managerScope, {
        regionId: existing.guard?.regionId || null,
        regionalOfficeId: existing.guard?.regionalOfficeId || null,
      })
    ) {
      return forbidden("Forbidden: loan is outside your scope.")
    }

    if (body.status !== undefined) {
      return badRequest("status changes must use /api/payroll/loans/finalize or /unfinalize.")
    }

    const updated = await prisma.loan.update({
      where: { id },
      data: {
        amount: body.amount != null ? Number(body.amount) : undefined,
        deploymentDays: body.deploymentDays != null ? Number(body.deploymentDays) : undefined,
        supervisor: body.supervisor !== undefined ? String(body.supervisor || "") : undefined,
        manager: body.manager !== undefined ? String(body.manager || "") : undefined,
      },
      include: {
        guard: {
          select: {
            id: true,
            name: true,
            parwestId: true,
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating payroll loan:", error)
    return internalServerError("Failed to update payroll loan")
  }
}

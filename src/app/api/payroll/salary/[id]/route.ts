import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

const ALLOWED_PAYMENT_STATUSES = new Set(["PENDING", "UNPAID", "PAID"])
const ALLOWED_PAYMENT_METHODS = new Set(["BANK", "CASH", "MOBILE"])

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
    const paymentStatus =
      body.paymentStatus !== undefined && body.paymentStatus !== null
        ? String(body.paymentStatus).toUpperCase()
        : undefined
    const paymentMethodRaw =
      body.paymentMethod !== undefined && body.paymentMethod !== null
        ? String(body.paymentMethod).trim()
        : undefined
    const paymentMethod = paymentMethodRaw ? paymentMethodRaw.toUpperCase() : paymentMethodRaw

    if (paymentStatus && !ALLOWED_PAYMENT_STATUSES.has(paymentStatus)) {
      return badRequest("paymentStatus must be PENDING, UNPAID, or PAID.")
    }
    if (paymentMethod !== undefined && paymentMethod !== "" && !ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
      return badRequest("paymentMethod must be BANK, CASH, or MOBILE.")
    }

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

    const paymentRemarks =
      body.paymentRemarks !== undefined ? String(body.paymentRemarks || "") : undefined

    const updated = await prisma.payroll.update({
      where: { id },
      data: {
        paymentStatus,
        paymentMethod:
          paymentMethod !== undefined
            ? paymentMethod === ""
              ? null
              : paymentMethod
            : undefined,
        paymentRemarks: paymentRemarks === undefined ? undefined : paymentRemarks || null,
        paymentUpdatedAt: paymentStatus || paymentRemarks !== undefined ? new Date() : undefined,
      },
      include: {
        guard: { select: { id: true, name: true, parwestId: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") {
      return notFound("Payroll row not found.")
    }
    console.error("Error updating payroll salary row:", error)
    return internalServerError("Failed to update payroll row.")
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

const ALLOWED_INVOICE_STATUSES = new Set([
  "DRAFT", "PENDING", "ADVANCE_PAID", "PARTIAL_PAID", "PAID", "UNPAID", "OVERDUE",
])

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

    const existing = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: {
          select: { regionId: true },
        },
      },
    })
    if (!existing) {
      return notFound("Invoice not found.")
    }

    if (managerScope && managerScopeDenied(managerScope, { regionId: existing.client?.regionId || null })) {
      return forbidden("Forbidden: invoice is outside your scope.")
    }

    const status = body?.status ? String(body.status).toUpperCase() : undefined
    if (status && !ALLOWED_INVOICE_STATUSES.has(status)) {
      return badRequest("Invalid invoice status.")
    }
    const paidAt = body?.paidAt ? new Date(body.paidAt) : undefined
    const dueDate = body?.dueDate ? new Date(body.dueDate) : undefined
    const amount = body?.amount != null ? Number(body.amount) : undefined

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status,
        paidAt,
        dueDate,
        amount,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            regionId: true,
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating invoice:", error)
    return internalServerError("Failed to update invoice")
  }
}

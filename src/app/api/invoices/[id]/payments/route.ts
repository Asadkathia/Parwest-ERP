import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"

function round2(value: number) {
  return Math.round(value * 100) / 100
}

export async function POST(
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
    const amount = Number(body?.amount)
    const method = body?.method ? String(body.method) : null
    const paidAtBody = body?.paidAt ? new Date(body.paidAt) : new Date()
    const notes = body?.notes ? String(body.notes) : null

    if (!Number.isFinite(amount) || amount <= 0) {
      return badRequest("amount must be > 0.")
    }

    const existing = await prisma.invoice.findUnique({
      where: { id },
      include: { client: { select: { regionId: true } } },
    })
    if (!existing) return notFound("Invoice not found.")

    if (managerScope && managerScopeDenied(managerScope, { regionId: existing.client?.regionId || null })) {
      return forbidden("Forbidden: invoice is outside your scope.")
    }

    const newPaid = round2(existing.paidAmount + amount)
    if (newPaid > existing.amount + 0.001) {
      return badRequest(`Payment exceeds invoice balance. Outstanding: ${round2(existing.amount - existing.paidAmount)}`)
    }

    let nextStatus = existing.status
    let nextPaidAt = existing.paidAt
    if (newPaid >= existing.amount - 0.001) {
      nextStatus = "PAID"
      nextPaidAt = paidAtBody
    } else if (newPaid > 0) {
      nextStatus = "PARTIAL_PAID"
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        paidAmount: newPaid,
        status: nextStatus,
        paidAt: nextPaidAt,
      },
      include: {
        client: { select: { id: true, name: true, regionId: true } },
        branch: { select: { id: true, name: true } },
        lineItems: { orderBy: { createdAt: "asc" } },
      },
    })

    await safeAuditLog({
      userId: session.user?.id || null,
      event: "INVOICE_PAYMENT_RECORDED",
      module: "PAYROLL",
      description: `Recorded payment ${amount}${method ? ` via ${method}` : ""} on invoice ${updated.invoiceNumber} (paid=${newPaid}/${existing.amount})${notes ? ` — ${notes}` : ""}`,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error recording invoice payment:", error)
    return internalServerError("Failed to record payment")
  }
}

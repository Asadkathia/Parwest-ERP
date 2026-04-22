import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"

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
    const body = await request.json().catch(() => ({}))
    const reason = String(body?.reason || "").trim()
    if (!reason) return badRequest("A void reason is required.")

    const existing = await prisma.invoice.findUnique({
      where: { id },
      include: { client: { select: { regionId: true } } },
    })
    if (!existing) return notFound("Invoice not found.")

    if (managerScope && managerScopeDenied(managerScope, { regionId: existing.client?.regionId || null })) {
      return forbidden("Forbidden: invoice is outside your scope.")
    }

    if (existing.status === "VOID") {
      return badRequest("Invoice is already voided.")
    }
    if (existing.paidAmount > 0) {
      return badRequest("Cannot void an invoice with recorded payments. Refund first.")
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: "VOID", voidedAt: new Date(), voidReason: reason },
      include: {
        client: { select: { id: true, name: true, regionId: true } },
        branch: { select: { id: true, name: true } },
        lineItems: { orderBy: { createdAt: "asc" } },
      },
    })

    await safeAuditLog({
      userId: session.user?.id || null,
      event: "INVOICE_VOID",
      module: "PAYROLL",
      description: `Voided invoice ${updated.invoiceNumber} — ${reason}`,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error voiding invoice:", error)
    return internalServerError("Failed to void invoice")
  }
}

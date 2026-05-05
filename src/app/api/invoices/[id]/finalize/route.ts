import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ok, badRequest, forbidden, notFound, unauthorized, internalServerError } from "@/lib/api/response"
import { isSuperAdmin } from "@/lib/api/permissions"
import { applyAvailableAdvances } from "@/lib/invoicing/applyAdvances"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"

/**
 * Finalize a DRAFT invoice → PENDING. Admin / Super User only.
 * Applies any available client advances on transition.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user) return unauthorized()
    if (!isSuperAdmin(session)) {
      return forbidden("Only Admin / Super User can finalize draft invoices.")
    }
    const { id } = await ctx.params

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, invoiceNumber: true, clientId: true, branchId: true, amount: true },
    })
    if (!invoice) return notFound("Invoice not found")
    if (invoice.status !== "DRAFT") {
      return badRequest(`Invoice is already ${invoice.status}.`)
    }

    const finalized = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: "PENDING" },
      })
      const { applied } = await applyAvailableAdvances(tx, {
        invoiceId: inv.id,
        clientId: inv.clientId,
        branchId: inv.branchId,
        invoiceAmount: inv.amount,
      })
      if (applied > 0) {
        const fullyPaid = applied + 0.001 >= inv.amount
        return tx.invoice.update({
          where: { id: inv.id },
          data: {
            paidAmount: applied,
            status: fullyPaid ? "PAID" : "PARTIAL_PAID",
            paidAt: fullyPaid ? new Date() : null,
          },
        })
      }
      return inv
    })

    await safeAuditLog({
      userId: session.user.id || null,
      event: "INVOICE_FINALIZE",
      module: "PAYROLL",
      description: `Finalized ${finalized.invoiceNumber} → ${finalized.status}`,
    })

    return ok(finalized)
  } catch (e) {
    console.error("finalize invoice failed:", e)
    return internalServerError("Failed to finalize invoice.")
  }
}

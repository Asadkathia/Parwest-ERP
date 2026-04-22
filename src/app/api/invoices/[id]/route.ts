import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { parseInvoiceStatus } from "@/lib/invoicing/status"

const ALLOWED_LINE_KINDS = new Set(["GUARD_SALARY", "SPECIAL_DUTY", "MANUAL"])

function round2(value: number) {
  return Math.round(value * 100) / 100
}

type IncomingLineItem = {
  kind?: string
  refId?: string | null
  description?: string
  quantity?: number | string
  unitPrice?: number | string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { id } = await params
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, regionId: true } },
        branch: { select: { id: true, name: true } },
        lineItems: { orderBy: { createdAt: "asc" } },
      },
    })
    if (!invoice) return notFound("Invoice not found.")

    if (managerScope && managerScopeDenied(managerScope, { regionId: invoice.client?.regionId || null })) {
      return forbidden("Forbidden: invoice is outside your scope.")
    }

    return NextResponse.json(invoice)
  } catch (error) {
    console.error("Error fetching invoice:", error)
    return internalServerError("Failed to fetch invoice")
  }
}

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
        client: { select: { regionId: true } },
      },
    })
    if (!existing) {
      return notFound("Invoice not found.")
    }

    if (managerScope && managerScopeDenied(managerScope, { regionId: existing.client?.regionId || null })) {
      return forbidden("Forbidden: invoice is outside your scope.")
    }

    if (existing.status === "VOID") {
      return badRequest("This invoice is voided and cannot be edited.")
    }

    let status: ReturnType<typeof parseInvoiceStatus> | undefined = undefined
    if (body?.status !== undefined) {
      const parsed = parseInvoiceStatus(body.status)
      if (!parsed) return badRequest("Invalid invoice status.")
      if (parsed === "VOID") return badRequest("Use POST /invoices/[id]/void to void an invoice.")
      status = parsed
    }

    const dueDate = body?.dueDate !== undefined
      ? (body.dueDate ? new Date(body.dueDate) : null)
      : undefined
    const notes = body?.notes !== undefined ? (body.notes ? String(body.notes) : null) : undefined

    let taxRate: number | null | undefined = undefined
    if (body?.taxRate !== undefined) {
      if (body.taxRate === null || body.taxRate === "") {
        taxRate = null
      } else {
        const tr = Number(body.taxRate)
        if (!Number.isFinite(tr) || tr < 0 || tr > 1) {
          return badRequest("taxRate must be a decimal between 0 and 1.")
        }
        taxRate = tr
      }
    }

    // Validate line items if provided
    type PreparedItem = {
      kind: string
      refId: string | null
      description: string
      quantity: number
      unitPrice: number
      lineTotal: number
    }
    let prepared: PreparedItem[] | null = null
    if (Array.isArray(body?.lineItems)) {
      prepared = []
      for (const item of body.lineItems as IncomingLineItem[]) {
        const kind = String(item?.kind || "").toUpperCase()
        if (!ALLOWED_LINE_KINDS.has(kind)) {
          return badRequest(`Invalid line item kind: ${kind}`)
        }
        const description = String(item?.description || "").trim()
        if (!description) return badRequest("Each line item requires a description.")
        const quantity = item?.quantity != null ? Number(item.quantity) : 1
        const unitPrice = Number(item?.unitPrice)
        if (!Number.isFinite(quantity) || quantity <= 0) return badRequest("Line item quantity must be > 0.")
        if (!Number.isFinite(unitPrice) || unitPrice < 0) return badRequest("Line item unitPrice must be >= 0.")
        const refId = item?.refId ? String(item.refId) : null
        if (kind === "GUARD_SALARY") {
          if (!refId) return badRequest("GUARD_SALARY line items require refId.")
          const exists = await prisma.payroll.findUnique({ where: { id: refId }, select: { id: true } })
          if (!exists) return badRequest(`Payroll ${refId} not found.`)
        } else if (kind === "SPECIAL_DUTY") {
          if (!refId) return badRequest("SPECIAL_DUTY line items require refId.")
          const exists = await prisma.payrollSpecialDuty.findUnique({ where: { id: refId }, select: { id: true } })
          if (!exists) return badRequest(`Special duty ${refId} not found.`)
        }
        prepared.push({
          kind,
          refId,
          description,
          quantity,
          unitPrice,
          lineTotal: round2(quantity * unitPrice),
        })
      }
    }

    // Compute totals if line items or tax changed
    const effectiveTaxRate =
      taxRate !== undefined ? taxRate : existing.taxRate
    let computedSubtotal: number | undefined
    let computedTax: number | undefined
    let computedAmount: number | undefined

    if (prepared) {
      computedSubtotal = round2(prepared.reduce((acc, i) => acc + i.lineTotal, 0))
      computedTax = round2(computedSubtotal * (effectiveTaxRate ?? 0))
      computedAmount = round2(computedSubtotal + computedTax)
    } else if (taxRate !== undefined) {
      computedSubtotal = existing.subtotal
      computedTax = round2(existing.subtotal * (effectiveTaxRate ?? 0))
      computedAmount = round2(computedSubtotal + computedTax)
    }

    // Status-driven payment fields
    const baseAmount = computedAmount ?? existing.amount
    let paidAt: Date | null | undefined = undefined
    let paidAmount: number | undefined
    const finalStatus: typeof status = status

    if (status === "PAID") {
      paidAt = new Date()
      paidAmount = baseAmount
    } else if (status === "PARTIAL_PAID") {
      const pa = Number(body?.paidAmount)
      if (!Number.isFinite(pa) || pa <= 0 || pa >= baseAmount) {
        return badRequest("paidAmount required and must satisfy 0 < paidAmount < amount for PARTIAL_PAID.")
      }
      paidAmount = round2(pa)
    } else if (status === "ADVANCE_PAID") {
      paidAt = new Date()
      const pa = body?.paidAmount != null ? Number(body.paidAmount) : baseAmount
      if (!Number.isFinite(pa) || pa < 0) return badRequest("Invalid paidAmount.")
      paidAmount = round2(pa)
    } else if (status === "UNPAID") {
      paidAt = null
      paidAmount = 0
    } else if (body?.paidAmount !== undefined && status === undefined) {
      const pa = Number(body.paidAmount)
      if (!Number.isFinite(pa) || pa < 0) return badRequest("Invalid paidAmount.")
      paidAmount = round2(pa)
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (prepared) {
        await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } })
        if (prepared.length) {
          await tx.invoiceLineItem.createMany({
            data: prepared.map((p) => ({
              invoiceId: id,
              kind: p.kind,
              refId: p.refId,
              description: p.description,
              quantity: p.quantity,
              unitPrice: p.unitPrice,
              lineTotal: p.lineTotal,
            })),
          })
        }
      }

      return tx.invoice.update({
        where: { id },
        data: {
          status: finalStatus,
          paidAt,
          dueDate,
          notes,
          taxRate: taxRate === undefined ? undefined : taxRate,
          subtotal: computedSubtotal,
          taxAmount: computedTax,
          amount: computedAmount,
          paidAmount,
        },
        include: {
          client: { select: { id: true, name: true, regionId: true } },
          branch: { select: { id: true, name: true } },
          lineItems: { orderBy: { createdAt: "asc" } },
        },
      })
    })

    await safeAuditLog({
      userId: session.user?.id || null,
      event: "INVOICE_UPDATE",
      module: "PAYROLL",
      description: `Updated invoice ${updated.invoiceNumber} (status=${updated.status}, amount=${updated.amount}, paid=${updated.paidAmount})`,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating invoice:", error)
    return internalServerError("Failed to update invoice")
  }
}

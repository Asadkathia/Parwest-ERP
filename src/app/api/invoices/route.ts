import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, internalServerError, unauthorized, forbidden, notFound } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import type { Prisma } from "@prisma/client"
import { parseInvoiceStatus } from "@/lib/invoicing/status"
import { applyAvailableAdvances } from "@/lib/invoicing/applyAdvances"

const ALLOWED_LINE_KINDS = new Set(["GUARD_SALARY", "SPECIAL_DUTY", "MANUAL"])

function parseMonthStart(month: string) {
  const value = `${month}-01T00:00:00.000Z`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function nextMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
}

function generateInvoiceNumber() {
  const ts = Date.now().toString().slice(-8)
  return `INV-${ts}`
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "VIEW")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get("clientId") || undefined
    const branchId = searchParams.get("branchId") || undefined
    const status = searchParams.get("status") || undefined
    const month = searchParams.get("month") || undefined
    const search = searchParams.get("search")?.trim()
    const regionId = searchParams.get("regionId")
    const regionalOfficeId = searchParams.get("regionalOfficeId")

    if (managerScopeDenied(managerScope, { regionId, regionalOfficeId })) {
      return forbidden("Forbidden: requested scope is outside your assigned region.")
    }

    const where: Prisma.InvoiceWhereInput = {}
    if (clientId) where.clientId = clientId
    if (branchId) where.branchId = branchId
    if (status) {
      const parsed = parseInvoiceStatus(status)
      if (!parsed) return badRequest("Invalid status filter.")
      where.status = parsed
    }

    if (month) {
      const start = parseMonthStart(month)
      if (start) {
        where.month = {
          gte: start,
          lt: nextMonth(start),
        }
      }
    }

    const clientScope = buildManagerScopeWhere(managerScope, { regionId: "regionId" })
    const clientFilter = {
      ...(regionId ? { regionId } : {}),
      ...clientScope,
    }
    if (Object.keys(clientFilter).length > 0) {
      where.client = { is: clientFilter }
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { client: { is: { name: { contains: search, mode: "insensitive" } } } },
      ]
    }

    const rows = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            regionId: true,
          },
        },
        branch: {
          select: { id: true, name: true },
        },
        _count: { select: { lineItems: true } },
      },
      take: 300,
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching invoices:", error)
    return internalServerError("Failed to fetch invoices")
  }
}

type IncomingLineItem = {
  kind?: string
  refId?: string | null
  description?: string
  quantity?: number | string
  unitPrice?: number | string
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "CREATE")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const body = await request.json()
    const clientId = body?.clientId ? String(body.clientId) : ""
    const branchId = body?.branchId ? String(body.branchId) : null
    const monthValue = body?.month ? String(body.month) : ""
    const dueDate = body?.dueDate ? new Date(body.dueDate) : null
    const notes = body?.notes ? String(body.notes) : null
    const taxRateRaw = body?.taxRate
    const status = parseInvoiceStatus(body?.status ?? "DRAFT")
    const incomingItems: IncomingLineItem[] = Array.isArray(body?.lineItems) ? body.lineItems : []

    if (!clientId || !monthValue) {
      return badRequest("clientId and month are required.")
    }
    if (!status || status === "VOID") {
      return badRequest("Invalid invoice status.")
    }

    const month = parseMonthStart(monthValue)
    if (!month) {
      return badRequest("month must be in YYYY-MM format.")
    }

    let taxRate: number | null = null
    if (taxRateRaw !== undefined && taxRateRaw !== null && taxRateRaw !== "") {
      const tr = Number(taxRateRaw)
      if (!Number.isFinite(tr) || tr < 0 || tr > 1) {
        return badRequest("taxRate must be a decimal between 0 and 1.")
      }
      taxRate = tr
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, regionId: true },
    })
    if (!client) {
      return notFound("Client not found.")
    }

    if (managerScope && managerScopeDenied(managerScope, { regionId: client.regionId })) {
      return forbidden("Forbidden: cannot create invoice outside your scope.")
    }

    if (branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { id: true, clientId: true },
      })
      if (!branch || branch.clientId !== clientId) {
        return badRequest("branchId does not belong to the given client.")
      }
    }

    // Validate and prepare line items
    type PreparedItem = {
      kind: string
      refId: string | null
      description: string
      quantity: number
      unitPrice: number
      lineTotal: number
    }
    const prepared: PreparedItem[] = []
    for (const item of incomingItems) {
      const kind = String(item?.kind || "").toUpperCase()
      if (!ALLOWED_LINE_KINDS.has(kind)) {
        return badRequest(`Invalid line item kind: ${kind}`)
      }
      const description = String(item?.description || "").trim()
      if (!description) {
        return badRequest("Each line item requires a description.")
      }
      const quantity = item?.quantity != null ? Number(item.quantity) : 1
      const unitPrice = Number(item?.unitPrice)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return badRequest("Line item quantity must be > 0.")
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return badRequest("Line item unitPrice must be >= 0.")
      }
      const refId = item?.refId ? String(item.refId) : null
      if (kind === "GUARD_SALARY") {
        if (!refId) return badRequest("GUARD_SALARY line items require refId (payrollId or deploymentId).")
        const [payroll, deployment] = await Promise.all([
          prisma.payroll.findUnique({ where: { id: refId }, select: { id: true } }),
          prisma.deployment.findUnique({ where: { id: refId }, select: { id: true } }),
        ])
        if (!payroll && !deployment) {
          return badRequest(`No Payroll or Deployment found with id ${refId} for GUARD_SALARY line item.`)
        }
      } else if (kind === "SPECIAL_DUTY") {
        if (!refId) return badRequest("SPECIAL_DUTY line items require refId (specialDutyId).")
        const exists = await prisma.payrollSpecialDuty.findUnique({ where: { id: refId }, select: { id: true } })
        if (!exists) return badRequest(`Special duty ${refId} not found for SPECIAL_DUTY line item.`)
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

    const subtotal = round2(prepared.reduce((acc, i) => acc + i.lineTotal, 0))
    const taxAmount = round2(subtotal * (taxRate ?? 0))
    const amount = round2(subtotal + taxAmount)

    const existingForPeriod = await prisma.invoice.findFirst({
      where: { clientId, branchId: branchId || null, month },
      select: { id: true, invoiceNumber: true, status: true },
    })
    if (existingForPeriod && existingForPeriod.status !== "VOID") {
      return badRequest(
        `An invoice already exists for this client/branch/month (${existingForPeriod.invoiceNumber}). Void it first to re-issue.`,
      )
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          clientId,
          branchId: branchId || null,
          invoiceNumber: generateInvoiceNumber(),
          month,
          amount,
          subtotal,
          taxRate,
          taxAmount,
          paidAmount: 0,
          notes,
          dueDate,
          status,
          lineItems: prepared.length
            ? {
                create: prepared.map((p) => ({
                  kind: p.kind,
                  refId: p.refId,
                  description: p.description,
                  quantity: p.quantity,
                  unitPrice: p.unitPrice,
                  lineTotal: p.lineTotal,
                })),
              }
            : undefined,
        },
      })

      // Auto-apply any outstanding client/branch advance payments
      const { applied } = await applyAvailableAdvances(tx, {
        invoiceId: created.id,
        clientId,
        branchId: branchId || null,
        invoiceAmount: amount,
      })

      if (applied > 0) {
        const fullyPaid = applied + 0.001 >= amount
        await tx.invoice.update({
          where: { id: created.id },
          data: {
            paidAmount: applied,
            status: fullyPaid ? "PAID" : applied > 0 && applied < amount ? "PARTIAL_PAID" : created.status,
            paidAt: fullyPaid ? new Date() : null,
          },
        })
      }

      return tx.invoice.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          client: { select: { id: true, name: true, regionId: true } },
          branch: { select: { id: true, name: true } },
          lineItems: true,
          advanceApplications: { include: { advance: { select: { id: true, paymentDate: true, amount: true } } } },
        },
      })
    })

    await safeAuditLog({
      userId: session.user?.id || null,
      event: "INVOICE_CREATE",
      module: "PAYROLL",
      description: `Created invoice ${invoice.invoiceNumber} for client ${clientId} (amount ${amount})`,
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error("Error creating invoice:", error)
    return internalServerError("Failed to create invoice")
  }
}

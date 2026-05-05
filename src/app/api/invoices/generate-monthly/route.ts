import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { applyAvailableAdvances } from "@/lib/invoicing/applyAdvances"
import { buildInvoiceLines } from "@/lib/invoicing/buildLines"

function parseMonthStart(month: string) {
  const value = `${month}-01T00:00:00.000Z`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}
function nextMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
}
function round2(n: number) { return Math.round(n * 100) / 100 }
function generateInvoiceNumber(seq: number) {
  const ts = Date.now().toString().slice(-6)
  return `INV-${ts}-${String(seq).padStart(3, "0")}`
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "CREATE")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const body = await request.json()
    const monthValue = body?.month ? String(body.month) : ""
    const taxRateRaw = body?.taxRate
    const requestedClientIds: string[] | null = Array.isArray(body?.clientIds)
      ? body.clientIds.map((s: unknown) => String(s))
      : null
    const groupByBranch: boolean = body?.groupByBranch !== false // default true

    if (!monthValue) return badRequest("month is required.")
    const monthStart = parseMonthStart(monthValue)
    if (!monthStart) return badRequest("month must be YYYY-MM.")
    const monthEnd = nextMonth(monthStart)

    let taxRate: number | null = null
    if (taxRateRaw !== undefined && taxRateRaw !== null && taxRateRaw !== "") {
      const tr = Number(taxRateRaw)
      if (!Number.isFinite(tr) || tr < 0 || tr > 1) return badRequest("taxRate must be 0..1.")
      taxRate = tr
    }

    // Find clients with deployments in the month (scoped)
    const clientWhere = requestedClientIds?.length ? { id: { in: requestedClientIds } } : {}
    const candidates = await prisma.client.findMany({
      where: clientWhere,
      select: { id: true, name: true, regionId: true },
    })
    const inScope = candidates.filter((c) =>
      !managerScope || !managerScopeDenied(managerScope, { regionId: c.regionId })
    )

    const created: { clientId: string; branchId: string | null; invoiceNumber: string; amount: number }[] = []
    const skipped: { clientId: string; branchId: string | null; reason: string }[] = []
    const errors: { clientId: string; branchId: string | null; message: string }[] = []
    let seq = 1

    for (const client of inScope) {
      // determine branches that had deployments this month
      const targets: { branchId: string | null }[] = []
      if (groupByBranch) {
        const branches = await prisma.deployment.findMany({
          where: { clientId: client.id, deploymentDate: { gte: monthStart, lt: monthEnd } },
          select: { branchId: true },
          distinct: ["branchId"],
        })
        for (const b of branches) targets.push({ branchId: b.branchId })
        if (!targets.length) targets.push({ branchId: null })
      } else {
        targets.push({ branchId: null })
      }

      for (const t of targets) {
        try {
          const dup = await prisma.invoice.findFirst({
            where: { clientId: client.id, branchId: t.branchId, month: monthStart, status: { not: "VOID" } },
            select: { id: true, invoiceNumber: true },
          })
          if (dup) {
            skipped.push({ clientId: client.id, branchId: t.branchId, reason: `exists (${dup.invoiceNumber})` })
            continue
          }

          const { items } = await buildInvoiceLines({
            clientId: client.id, branchId: t.branchId, monthStart, monthEnd,
          })
          if (!items.length) {
            skipped.push({ clientId: client.id, branchId: t.branchId, reason: "no billable activity" })
            continue
          }

          const subtotal = round2(items.reduce((acc, i) => acc + i.lineTotal, 0))
          const taxAmount = round2(subtotal * (taxRate ?? 0))
          const amount = round2(subtotal + taxAmount)

          const invoice = await prisma.$transaction(async (tx) => {
            const inv = await tx.invoice.create({
              data: {
                clientId: client.id,
                branchId: t.branchId,
                invoiceNumber: generateInvoiceNumber(seq++),
                month: monthStart,
                amount, subtotal, taxRate, taxAmount, paidAmount: 0,
                status: "DRAFT",
                lineItems: { create: items },
              },
            })
            const { applied } = await applyAvailableAdvances(tx, {
              invoiceId: inv.id, clientId: client.id, branchId: t.branchId, invoiceAmount: amount,
            })
            if (applied > 0) {
              const fullyPaid = applied + 0.001 >= amount
              await tx.invoice.update({
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

          created.push({
            clientId: client.id, branchId: t.branchId,
            invoiceNumber: invoice.invoiceNumber, amount,
          })
        } catch (e) {
          errors.push({
            clientId: client.id, branchId: t.branchId,
            message: e instanceof Error ? e.message : "unknown",
          })
        }
      }
    }

    await safeAuditLog({
      userId: session.user?.id || null,
      event: "INVOICE_BULK_GENERATE",
      module: "PAYROLL",
      description: `Bulk generate ${monthValue}: created=${created.length} skipped=${skipped.length} errors=${errors.length}`,
    })

    return NextResponse.json({
      month: monthValue,
      summary: { created: created.length, skipped: skipped.length, errors: errors.length },
      created, skipped, errors,
    })
  } catch (error) {
    console.error("Error in bulk invoice generate:", error)
    return internalServerError("Failed to generate invoices")
  }
}

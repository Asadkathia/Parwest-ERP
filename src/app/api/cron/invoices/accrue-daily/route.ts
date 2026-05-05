import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { isAuthorizedCronRequest } from "@/lib/cron/auth"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"
import { buildInvoiceLines } from "@/lib/invoicing/buildLines"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function monthStart(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}
function nextMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
}
function ymd(d: Date) {
  return d.toISOString().slice(0, 10)
}
function generateInvoiceNumber(seq: number) {
  const ts = Date.now().toString().slice(-6)
  return `INV-${ts}-${String(seq).padStart(3, "0")}`
}

/**
 * Daily accrual cron.
 *
 * For every active client (by branch where applicable) that has billable
 * activity in the current month, upserts a single DRAFT invoice for the month
 * whose line items reflect the month-to-date totals.
 *
 * Idempotent: re-runs replace the DRAFT's line items in a transaction.
 * Skips clients/branches whose month already has a non-DRAFT invoice
 * (already finalized — never overwrite).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!isWorkflowRuleEnabled("invoicing.autoAccrualEnabled")) {
    return NextResponse.json({ skipped: "autoAccrual disabled" })
  }

  const now = new Date()
  const mStart = monthStart(now)
  const mEnd = nextMonth(mStart)
  const asOf = now

  const updated: { invoiceNumber: string; clientId: string; branchId: string | null; amount: number }[] = []
  const created: typeof updated = []
  const skipped: { clientId: string; branchId: string | null; reason: string }[] = []
  const errors: { clientId: string; branchId: string | null; message: string }[] = []
  let seq = 1

  try {
    const clients = await prisma.client.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    })

    for (const client of clients) {
      const branches = await prisma.deployment.findMany({
        where: {
          clientId: client.id,
          deploymentDate: { gte: mStart, lt: mEnd },
        },
        select: { branchId: true },
        distinct: ["branchId"],
      })
      const targets: { branchId: string | null }[] =
        branches.length > 0 ? branches.map((b) => ({ branchId: b.branchId })) : [{ branchId: null }]

      for (const t of targets) {
        try {
          const existing = await prisma.invoice.findFirst({
            where: {
              clientId: client.id,
              branchId: t.branchId,
              month: mStart,
              status: { not: "VOID" },
            },
            select: { id: true, status: true, invoiceNumber: true },
          })
          if (existing && existing.status !== "DRAFT") {
            skipped.push({
              clientId: client.id,
              branchId: t.branchId,
              reason: `already finalized (${existing.invoiceNumber}, ${existing.status})`,
            })
            continue
          }

          const { items } = await buildInvoiceLines({
            clientId: client.id,
            branchId: t.branchId,
            monthStart: mStart,
            monthEnd: mEnd,
            asOf,
          })
          if (!items.length) {
            skipped.push({ clientId: client.id, branchId: t.branchId, reason: "no billable activity yet" })
            continue
          }

          const subtotal = round2(items.reduce((acc, i) => acc + i.lineTotal, 0))
          const amount = subtotal

          if (existing) {
            const inv = await prisma.$transaction(async (tx) => {
              await tx.invoiceLineItem.deleteMany({ where: { invoiceId: existing.id } })
              return tx.invoice.update({
                where: { id: existing.id },
                data: {
                  amount,
                  subtotal,
                  taxAmount: 0,
                  notes: `Auto-accrued draft as of ${asOf.toISOString()}`,
                  lineItems: { create: items },
                },
              })
            })
            updated.push({
              invoiceNumber: inv.invoiceNumber,
              clientId: client.id,
              branchId: t.branchId,
              amount,
            })
          } else {
            const inv = await prisma.invoice.create({
              data: {
                clientId: client.id,
                branchId: t.branchId,
                invoiceNumber: generateInvoiceNumber(seq++),
                month: mStart,
                amount,
                subtotal,
                taxAmount: 0,
                paidAmount: 0,
                status: "DRAFT",
                notes: `Auto-accrued draft (started ${ymd(asOf)})`,
                lineItems: { create: items },
              },
            })
            created.push({
              invoiceNumber: inv.invoiceNumber,
              clientId: client.id,
              branchId: t.branchId,
              amount,
            })
          }
        } catch (e) {
          errors.push({
            clientId: client.id,
            branchId: t.branchId,
            message: e instanceof Error ? e.message : "unknown",
          })
        }
      }
    }

    await safeAuditLog({
      userId: null,
      event: "INVOICE_AUTO_ACCRUE",
      module: "PAYROLL",
      description: `Daily accrual ${ymd(mStart)}: created=${created.length} updated=${updated.length} skipped=${skipped.length} errors=${errors.length}`,
    })

    return NextResponse.json({
      month: ymd(mStart),
      asOf: asOf.toISOString(),
      summary: {
        created: created.length,
        updated: updated.length,
        skipped: skipped.length,
        errors: errors.length,
      },
      created,
      updated,
      skipped,
      errors,
    })
  } catch (error) {
    console.error("accrue-daily failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "accrue failed" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { isAuthorizedCronRequest } from "@/lib/cron/auth"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 120

function monthStart(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}
function ymd(d: Date) {
  return d.toISOString().slice(0, 10)
}

/**
 * Reminder cron — runs daily. For any DRAFT invoice whose month has already
 * ended, fan out a Notification to every Admin / Super User. Dedupe per day
 * via (userId, dedupeKey="INVOICE_DRAFT_PENDING:<invoiceId>:<YYYY-MM-DD>").
 *
 * Cadence is governed by the cron schedule (run daily; dedupe key prevents
 * duplicate sends within a day).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!isWorkflowRuleEnabled("invoicing.draftReminderEnabled")) {
    return NextResponse.json({ skipped: "draftReminder disabled" })
  }

  const now = new Date()
  const currentMonthStart = monthStart(now)
  const today = ymd(now)

  try {
    const pendingDrafts = await prisma.invoice.findMany({
      where: {
        status: "DRAFT",
        month: { lt: currentMonthStart },
      },
      select: {
        id: true,
        invoiceNumber: true,
        month: true,
        amount: true,
        client: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    })

    const admins = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: { name: { in: ["Admin", "Super User"] } },
      },
      select: { id: true },
    })

    if (admins.length === 0 || pendingDrafts.length === 0) {
      return NextResponse.json({
        runOn: today,
        summary: { drafts: pendingDrafts.length, admins: admins.length, sent: 0 },
      })
    }

    let sent = 0
    let dedupedCount = 0
    for (const inv of pendingDrafts) {
      const monthLabel = inv.month.toISOString().slice(0, 7)
      const title = `Pending draft invoice — ${inv.client.name}${inv.branch ? ` / ${inv.branch.name}` : ""}`
      const body = `Draft ${inv.invoiceNumber} for ${monthLabel} (PKR ${inv.amount.toLocaleString()}) is still unfinalized. Generate the invoice to bill the client.`
      const link = `/clients/invoicing?tab=drafts&invoiceId=${inv.id}`
      const dedupeKey = `INVOICE_DRAFT_PENDING:${inv.id}:${today}`

      for (const admin of admins) {
        try {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              type: "INVOICE_DRAFT_PENDING",
              title,
              body,
              link,
              dedupeKey,
              payload: {
                invoiceId: inv.id,
                invoiceNumber: inv.invoiceNumber,
                clientId: inv.client.id,
                branchId: inv.branch?.id ?? null,
                month: monthLabel,
                amount: inv.amount,
              },
            },
          })
          sent++
        } catch (e) {
          // unique violation on (userId, dedupeKey) → already sent today; ignore
          const msg = e instanceof Error ? e.message : ""
          if (msg.includes("Unique constraint") || msg.includes("Notification_user_dedupe_key")) {
            dedupedCount++
          } else {
            throw e
          }
        }
      }
    }

    await safeAuditLog({
      userId: null,
      event: "INVOICE_DRAFT_REMINDER",
      module: "PAYROLL",
      description: `Draft reminders ${today}: drafts=${pendingDrafts.length} sent=${sent} deduped=${dedupedCount}`,
    })

    return NextResponse.json({
      runOn: today,
      summary: {
        drafts: pendingDrafts.length,
        admins: admins.length,
        sent,
        deduped: dedupedCount,
      },
    })
  } catch (error) {
    console.error("remind-pending failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "reminder failed" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { affectedMonthStarts, recalcAffectedMonths } from "@/lib/payroll/special-duty-recalc"

type BulkLoanInput = {
  guardId: string
  amount: number
  loanDate: string
  notes?: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "CREATE")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const body = await request.json()
    const rows: BulkLoanInput[] = Array.isArray(body.rows) ? body.rows : []

    if (rows.length === 0) {
      return badRequest("rows array is required and must not be empty.")
    }

    const results: { guardId: string; success: boolean; loanId?: string; error?: string }[] = []
    // Track (guardId -> set of affected month-starts) so we can recompute each
    // affected payroll month once after the bulk insert completes.
    const affected = new Map<string, Map<string, Date>>()

    for (const row of rows) {
      if (!row.guardId || row.amount == null || !row.loanDate) {
        results.push({ guardId: row.guardId ?? "", success: false, error: "Missing required fields." })
        continue
      }

      const month = new Date(row.loanDate)
      if (Number.isNaN(month.getTime())) {
        results.push({ guardId: row.guardId, success: false, error: "Invalid loanDate." })
        continue
      }

      const guard = await prisma.guard.findUnique({
        where: { id: row.guardId },
        select: { id: true, regionId: true, regionalOfficeId: true },
      })

      if (!guard) {
        results.push({ guardId: row.guardId, success: false, error: "Guard not found." })
        continue
      }

      if (managerScope && managerScopeDenied(managerScope, { regionId: guard.regionId, regionalOfficeId: guard.regionalOfficeId })) {
        results.push({ guardId: row.guardId, success: false, error: "Guard is outside your scope." })
        continue
      }

      try {
        // NOTE: the Loan model has no free-text notes column. Bulk-imported
        // `notes` were previously stuffed into the `manager` field (a person
        // reference), corrupting that column — they are dropped here. If a
        // notes column is added later, write `row.notes` to it instead.
        const loan = await prisma.loan.create({
          data: {
            guardId: guard.id,
            month,
            amount: Number(row.amount),
            status: "PENDING",
          },
        })
        results.push({ guardId: row.guardId, success: true, loanId: loan.id })
        // Record the affected payroll month for this guard so the persisted
        // Payroll.loans/netSalary is recomputed below.
        const monthStarts = affectedMonthStarts(month, month)
        let monthsForGuard = affected.get(guard.id)
        if (!monthsForGuard) {
          monthsForGuard = new Map<string, Date>()
          affected.set(guard.id, monthsForGuard)
        }
        for (const m of monthStarts) monthsForGuard.set(m.toISOString(), m)
      } catch {
        results.push({ guardId: row.guardId, success: false, error: "Failed to create loan." })
      }
    }

    // Recompute every affected (guard, month) payroll so loan totals reflect the
    // import. Locked months are surfaced as warnings rather than mutated.
    const actorUserId =
      (session.user as { id?: string | null } | undefined)?.id ?? null
    const warnings: string[] = []
    for (const [guardId, monthsForGuard] of affected) {
      const w = await recalcAffectedMonths(
        guardId,
        Array.from(monthsForGuard.values()),
        actorUserId,
      )
      warnings.push(...w)
    }

    const successCount = results.filter((r) => r.success).length
    return NextResponse.json(
      warnings.length > 0
        ? { committed: successCount, total: rows.length, results, warnings }
        : { committed: successCount, total: rows.length, results },
      { status: 201 },
    )
  } catch (error) {
    console.error("Error committing bulk loans:", error)
    return internalServerError("Failed to commit bulk loans.")
  }
}

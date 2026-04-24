import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

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
        const loan = await prisma.loan.create({
          data: {
            guardId: guard.id,
            month,
            amount: Number(row.amount),
            status: "PENDING",
            ...(row.notes ? { manager: row.notes } : {}),
          },
        })
        results.push({ guardId: row.guardId, success: true, loanId: loan.id })
      } catch {
        results.push({ guardId: row.guardId, success: false, error: "Failed to create loan." })
      }
    }

    const successCount = results.filter((r) => r.success).length
    return NextResponse.json({ committed: successCount, total: rows.length, results }, { status: 201 })
  } catch (error) {
    console.error("Error committing bulk loans:", error)
    return internalServerError("Failed to commit bulk loans.")
  }
}

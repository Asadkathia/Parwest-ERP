/**
 * POST /api/payroll/reserve/release
 *
 * Issues a RELEASED transaction against a guard's accumulated reserve
 * balance. Validates the requested amount against the current balance
 * (Σ ACCRUED − Σ RELEASED) and rejects overdraws.
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  badRequest,
  forbidden,
  internalServerError,
  notFound,
  ok,
  unauthorized,
} from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { getActorIdentity } from "@/lib/payroll/state-permissions"

const VALID_PAYMENT_METHODS = new Set(["BANK", "CASH", "MOBILE"])

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")

    const body = (await request.json().catch(() => ({}))) as {
      guardId?: string
      amount?: number | string
      reason?: string
      paymentMethod?: string
      slipNumber?: string
      paidAt?: string
    }

    const guardId = body.guardId ? String(body.guardId) : ""
    const amount = Number(body.amount)
    const reason = (body.reason ?? "").trim()
    const paymentMethod = (body.paymentMethod ?? "").toUpperCase().trim()
    const slipNumber = (body.slipNumber ?? "").toString().trim()

    if (!guardId) return badRequest("guardId is required.")
    if (!Number.isFinite(amount) || amount <= 0) {
      return badRequest("amount must be a finite number greater than zero.")
    }
    if (!reason) return badRequest("reason is required.")
    if (!VALID_PAYMENT_METHODS.has(paymentMethod)) {
      return badRequest("paymentMethod must be one of BANK, CASH, MOBILE.")
    }
    if (!slipNumber) return badRequest("slipNumber is required.")

    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date()
    if (Number.isNaN(paidAt.getTime())) {
      return badRequest("paidAt is not a valid date.")
    }

    const guard = await prisma.guard.findUnique({
      where: { id: guardId },
      select: { id: true, regionId: true, regionalOfficeId: true },
    })
    if (!guard) return notFound("Guard not found.")

    const scope = deriveManagerScope(session)
    if (
      managerScopeDenied(scope, {
        regionId: guard.regionId ?? undefined,
        regionalOfficeId: guard.regionalOfficeId ?? undefined,
      })
    ) {
      return forbidden("This guard is outside your scope.")
    }

    // Compute current balance via grouped sums
    const sums = await prisma.payrollReserveLedger.groupBy({
      by: ["type"],
      where: { guardId },
      _sum: { amount: true },
    })
    let totalAccrued = 0
    let totalReleased = 0
    for (const row of sums) {
      const v = Number(row._sum.amount ?? 0)
      if (row.type === "ACCRUED") totalAccrued += v
      else if (row.type === "RELEASED") totalReleased += v
    }
    const balance = totalAccrued - totalReleased

    if (amount > balance) {
      return badRequest(
        `Requested amount (${amount.toFixed(
          2
        )}) exceeds available reserve balance (${balance.toFixed(2)}).`
      )
    }

    const actor = getActorIdentity(session)

    const ledger = await prisma.payrollReserveLedger.create({
      data: {
        guardId,
        payrollId: null,
        type: "RELEASED",
        amount,
        reason,
        byUserId: actor.id,
        byUserName: actor.name,
        paymentMethod,
        slipNumber,
        paidAt,
      },
      select: { id: true },
    })

    await safeAuditLog({
      userId: actor.id,
      event: "PAYROLL_RESERVE_RELEASE",
      module: "PAYROLL",
      description: `Released ${amount.toFixed(
        2
      )} from reserve for guard ${guardId} via ${paymentMethod} (slip ${slipNumber}) — reason: ${reason}`,
    })

    return ok({
      ledgerId: ledger.id,
      newBalance: balance - amount,
    })
  } catch (error) {
    console.error("reserve release failed:", error)
    return internalServerError("Failed to release reserve.")
  }
}

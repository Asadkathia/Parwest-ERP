/**
 * POST /api/payroll/reserve/release
 *
 * Issues a RELEASED transaction against a guard's accumulated reserve
 * balance. Validates the requested amount against the current balance
 * (Σ ACCRUED − Σ RELEASED) and rejects overdraws.
 */

import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  badRequest,
  conflict,
  forbidden,
  internalServerError,
  notFound,
  ok,
  unauthorized,
} from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { getActorIdentity } from "@/lib/payroll/state-permissions"

const VALID_PAYMENT_METHODS = new Set(["BANK", "CASH", "MOBILE"])

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "CREATE")) return forbidden("Access denied.")

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

    const actor = getActorIdentity(session)

    // Wrap balance check + insert in a Serializable transaction so two
    // concurrent releases for the same guard cannot both pass the balance
    // check and overdraw the reserve. Throw OVERDRAFT to short-circuit; catch
    // P2034 (serialization conflict) below and surface it as a 409.
    let result: { ledgerId: string; newBalance: number }
    try {
      result = await prisma.$transaction(
        async (tx) => {
          const sums = await tx.payrollReserveLedger.groupBy({
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
            throw new Error(`OVERDRAFT:${balance.toFixed(2)}`)
          }

          const ledger = await tx.payrollReserveLedger.create({
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

          return { ledgerId: ledger.id, newBalance: balance - amount }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("OVERDRAFT")) {
        const balanceStr = error.message.split(":")[1] ?? "0.00"
        return badRequest(
          `Requested amount (${amount.toFixed(
            2
          )}) exceeds available reserve balance (${balanceStr}).`
        )
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        return conflict("Concurrent release in progress; please retry.")
      }
      throw error
    }

    await safeAuditLog({
      userId: actor.id,
      event: "PAYROLL_RESERVE_RELEASE",
      module: "PAYROLL",
      description: `Released ${amount.toFixed(
        2
      )} from reserve for guard ${guardId} via ${paymentMethod} (slip ${slipNumber}) — reason: ${reason}`,
    })

    return ok(result)
  } catch (error) {
    console.error("reserve release failed:", error)
    return internalServerError("Failed to release reserve.")
  }
}

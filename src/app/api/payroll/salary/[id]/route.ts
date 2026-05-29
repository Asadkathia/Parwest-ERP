import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

/**
 * PATCH /api/payroll/salary/[id]
 *
 * NON-FINANCIAL salary-row mutation only (payment remarks + method).
 *
 * F-2 (payroll audit): this endpoint previously accepted `paymentStatus`
 * (including `PAID`) and wrote it directly with NO read of `Payroll.state`
 * and NO state guard. That fully bypassed the payment state machine and let
 * `state` and `paymentStatus` desync — a row could read `state="CALCULATED"`
 * (still freely recomputable, since `persist.ts` LOCKED_STATES keys on
 * `state`) yet `paymentStatus="PAID"`, so an already-"paid" guard's net could
 * be silently recomputed.
 *
 * The fix: payment-status is now a STATE-MACHINE-ONLY operation.
 *   - Marking PAID  → POST /api/payroll/state/mark-paid (gates on
 *     state ∈ {REGIONAL_LOCKED, GLOBAL_FINALIZED, EMERGENCY_RELEASED} and sets
 *     `state` and `paymentStatus` in lock-step).
 *   - Other lifecycle transitions → the other /api/payroll/state/* routes.
 * This PATCH rejects any `paymentStatus` change and only updates the
 * non-financial fields, so `state` ↔ `paymentStatus` can never drift here.
 */

const ALLOWED_PAYMENT_METHODS = new Set(["BANK", "CASH", "MOBILE"])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "UPDATE")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)
    const { id } = await params
    const body = await request.json()

    // F-2: payment status is owned by the state machine — never written here.
    if (body.paymentStatus !== undefined && body.paymentStatus !== null) {
      const requested = String(body.paymentStatus).toUpperCase()
      if (requested === "PAID") {
        return badRequest(
          "Payment status cannot be set here. Use the close workflow (POST /api/payroll/state/mark-paid) to mark a payroll PAID."
        )
      }
      return badRequest(
        "Payment status cannot be changed here. Use the payroll state machine (/api/payroll/state/*)."
      )
    }

    const paymentMethodRaw =
      body.paymentMethod !== undefined && body.paymentMethod !== null
        ? String(body.paymentMethod).trim()
        : undefined
    const paymentMethod = paymentMethodRaw ? paymentMethodRaw.toUpperCase() : paymentMethodRaw

    if (paymentMethod !== undefined && paymentMethod !== "" && !ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
      return badRequest("paymentMethod must be BANK, CASH, or MOBILE.")
    }

    const paymentRemarks =
      body.paymentRemarks !== undefined ? String(body.paymentRemarks || "") : undefined

    if (paymentMethod === undefined && paymentRemarks === undefined) {
      return badRequest("No updatable fields provided. Allowed: paymentMethod, paymentRemarks.")
    }

    const existing = await prisma.payroll.findUnique({
      where: { id },
      select: {
        id: true,
        guard: {
          select: {
            regionId: true,
            regionalOfficeId: true,
          },
        },
      },
    })
    if (!existing) {
      return notFound("Payroll row not found.")
    }
    if (
      managerScope &&
      managerScopeDenied(managerScope, {
        regionId: existing.guard?.regionId || null,
        regionalOfficeId: existing.guard?.regionalOfficeId || null,
      })
    ) {
      return forbidden("Forbidden: payroll row is outside your scope.")
    }

    const updated = await prisma.payroll.update({
      where: { id },
      data: {
        paymentMethod:
          paymentMethod !== undefined
            ? paymentMethod === ""
              ? null
              : paymentMethod
            : undefined,
        paymentRemarks: paymentRemarks === undefined ? undefined : paymentRemarks || null,
        paymentUpdatedAt: new Date(),
      },
      include: {
        guard: { select: { id: true, name: true, parwestId: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") {
      return notFound("Payroll row not found.")
    }
    console.error("Error updating payroll salary row:", error)
    return internalServerError("Failed to update payroll row.")
  }
}

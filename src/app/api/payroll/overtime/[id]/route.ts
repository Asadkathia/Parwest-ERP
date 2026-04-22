/**
 * PATCH /api/payroll/overtime/[id] — manual override of overtime hours/rate.
 * DELETE /api/payroll/overtime/[id] — clears overtime (sets hours/amount to 0).
 *
 * Both operations re-run the canonical payroll calc + persist in the same
 * transaction. The [id] here is a Payroll row id, not a separate overtime
 * record (overtime lives on the Payroll row).
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import {
  badRequest,
  forbidden,
  internalServerError,
  notFound,
  unauthorized,
} from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"
import { calculateGuardPayroll } from "@/lib/payroll/calculate"
import { persistGuardPayroll } from "@/lib/payroll/persist"

const LOCK_MESSAGE_FRAGMENT = "Cannot recalculate payroll"

async function loadPayroll(id: string) {
  return prisma.payroll.findUnique({
    where: { id },
    select: {
      id: true,
      guardId: true,
      month: true,
      guard: { select: { regionId: true, regionalOfficeId: true } },
    },
  })
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
    const payroll = await loadPayroll(id)
    if (!payroll) return notFound("Payroll record not found.")

    if (
      managerScope &&
      managerScopeDenied(managerScope, {
        regionId: payroll.guard?.regionId ?? null,
        regionalOfficeId: payroll.guard?.regionalOfficeId ?? null,
      })
    ) {
      return forbidden("Forbidden: guard is outside your scope.")
    }

    const body = await request.json()
    const hours = Number(body.hours)
    const rate = Number(body.rate)
    if (!Number.isFinite(hours) || hours < 0 || !Number.isFinite(rate) || rate < 0) {
      return badRequest("hours and rate must be non-negative numbers.")
    }
    const amount = Number((hours * rate).toFixed(2))
    const actorUserId =
      (session.user as { id?: string | null } | undefined)?.id ?? null

    try {
      await prisma.$transaction(async (tx) => {
        await tx.payroll.update({
          where: { id: payroll.id },
          data: { overtimeHours: hours, overtimeAmount: amount },
        })
        const computation = await calculateGuardPayroll(payroll.guardId, payroll.month, {
          trx: tx,
        })
        await persistGuardPayroll(computation, {
          trx: tx,
          actorUserId,
          setStateToCalculated: true,
        })
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.includes(LOCK_MESSAGE_FRAGMENT)) {
        return badRequest("Payroll for this month is locked. Cannot edit overtime.")
      }
      throw err
    }

    try {
      await prisma.auditLog.create({
        data: {
          userId: actorUserId,
          event: "PAYROLL_OVERTIME_UPDATE",
          module: "PAYROLL",
          description: `Updated overtime for payroll ${payroll.id} (guard ${payroll.guardId})`,
        },
      })
    } catch (auditErr) {
      console.error("Failed to write overtime audit log:", auditErr)
    }

    const saved = await prisma.payroll.findUnique({
      where: { id: payroll.id },
      include: { guard: { select: { id: true, name: true, parwestId: true } } },
    })
    return NextResponse.json(saved)
  } catch (error) {
    console.error("Error updating overtime:", error)
    return internalServerError("Failed to update overtime.")
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { id } = await params
    const payroll = await loadPayroll(id)
    if (!payroll) return notFound("Payroll record not found.")

    if (
      managerScope &&
      managerScopeDenied(managerScope, {
        regionId: payroll.guard?.regionId ?? null,
        regionalOfficeId: payroll.guard?.regionalOfficeId ?? null,
      })
    ) {
      return forbidden("Forbidden: guard is outside your scope.")
    }

    const actorUserId =
      (session.user as { id?: string | null } | undefined)?.id ?? null

    try {
      await prisma.$transaction(async (tx) => {
        await tx.payroll.update({
          where: { id: payroll.id },
          data: { overtimeHours: 0, overtimeAmount: 0 },
        })
        const computation = await calculateGuardPayroll(payroll.guardId, payroll.month, {
          trx: tx,
        })
        await persistGuardPayroll(computation, {
          trx: tx,
          actorUserId,
          setStateToCalculated: true,
        })
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.includes(LOCK_MESSAGE_FRAGMENT)) {
        return badRequest("Payroll for this month is locked. Cannot clear overtime.")
      }
      throw err
    }

    try {
      await prisma.auditLog.create({
        data: {
          userId: actorUserId,
          event: "PAYROLL_OVERTIME_UPDATE",
          module: "PAYROLL",
          description: `Cleared overtime for payroll ${payroll.id} (guard ${payroll.guardId})`,
        },
      })
    } catch (auditErr) {
      console.error("Failed to write overtime audit log:", auditErr)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error clearing overtime:", error)
    return internalServerError("Failed to clear overtime.")
  }
}

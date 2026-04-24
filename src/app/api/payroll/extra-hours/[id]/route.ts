import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { calculateGuardPayroll } from "@/lib/payroll/calculate"
import { persistGuardPayroll } from "@/lib/payroll/persist"

const LOCK_MESSAGE_FRAGMENT = "Cannot recalculate payroll"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "VIEW")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { id } = await params
    const row = await prisma.payroll.findUnique({
      where: { id },
      include: { guard: { select: { id: true, name: true, parwestId: true, regionId: true, regionalOfficeId: true } } },
    })
    if (!row) return notFound("Payroll row not found.")
    if (
      managerScope &&
      managerScopeDenied(managerScope, {
        regionId: row.guard?.regionId ?? null,
        regionalOfficeId: row.guard?.regionalOfficeId ?? null,
      })
    ) {
      return forbidden("Forbidden: payroll row is outside your scope.")
    }
    return NextResponse.json(row)
  } catch (error) {
    console.error("Error fetching extra hours record:", error)
    return internalServerError("Failed to fetch extra hours record.")
  }
}

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

    const hoursInput = body.hours != null ? Number(body.hours) : undefined
    const rateInput = body.rate != null ? Number(body.rate) : undefined
    const amountInput = body.amount != null ? Number(body.amount) : undefined

    const existing = await prisma.payroll.findUnique({
      where: { id },
      select: {
        id: true,
        guardId: true,
        month: true,
        extraHours: true,
        extraHoursAmount: true,
        guard: { select: { regionId: true, regionalOfficeId: true } },
      },
    })

    if (!existing) {
      return notFound("Payroll row not found.")
    }
    if (
      managerScope &&
      managerScopeDenied(managerScope, {
        regionId: existing.guard?.regionId ?? null,
        regionalOfficeId: existing.guard?.regionalOfficeId ?? null,
      })
    ) {
      return forbidden("Forbidden: payroll row is outside your scope.")
    }

    const nextHours = hoursInput ?? Number(existing.extraHours ?? 0)
    let nextAmount: number
    if (hoursInput != null && rateInput != null) {
      nextAmount = Number((hoursInput * rateInput).toFixed(2))
    } else if (amountInput != null) {
      nextAmount = Number(amountInput.toFixed(2))
    } else {
      nextAmount = Number(existing.extraHoursAmount ?? 0)
    }

    const actorUserId =
      (session.user as { id?: string | null } | undefined)?.id ?? null

    let payrollId: string
    try {
      payrollId = await prisma.$transaction(async (tx) => {
        await tx.payroll.update({
          where: { id },
          data: {
            extraHours: nextHours,
            extraHoursAmount: nextAmount,
          },
        })

        const computation = await calculateGuardPayroll(existing.guardId, existing.month, { trx: tx })
        const persisted = await persistGuardPayroll(computation, {
          trx: tx,
          actorUserId,
          setStateToCalculated: true,
        })
        return persisted.payrollId
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.includes(LOCK_MESSAGE_FRAGMENT)) {
        return badRequest("Payroll for this month is locked. Cannot edit extra hours.")
      }
      throw err
    }

    try {
      await prisma.auditLog.create({
        data: {
          userId: actorUserId,
          event: "PAYROLL_EXTRA_HOURS_PATCH",
          module: "PAYROLL",
          description: `Patched extra hours on payroll ${id} (guard ${existing.guardId})`,
        },
      })
    } catch (auditErr) {
      console.error("Failed to write extra-hours audit log:", auditErr)
    }

    const saved = await prisma.payroll.findUnique({
      where: { id: payrollId },
      include: { guard: { select: { id: true, name: true, parwestId: true } } },
    })
    return NextResponse.json(saved)
  } catch (error) {
    console.error("Error updating extra hours:", error)
    return internalServerError("Failed to update extra hours.")
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "DELETE")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { id } = await params
    const existing = await prisma.payroll.findUnique({
      where: { id },
      select: {
        id: true,
        guardId: true,
        month: true,
        guard: { select: { regionId: true, regionalOfficeId: true } },
      },
    })
    if (!existing) return notFound("Payroll row not found.")
    if (
      managerScope &&
      managerScopeDenied(managerScope, {
        regionId: existing.guard?.regionId ?? null,
        regionalOfficeId: existing.guard?.regionalOfficeId ?? null,
      })
    ) {
      return forbidden("Forbidden: payroll row is outside your scope.")
    }

    const actorUserId =
      (session.user as { id?: string | null } | undefined)?.id ?? null

    try {
      await prisma.$transaction(async (tx) => {
        await tx.payroll.update({
          where: { id },
          data: {
            extraHours: 0,
            extraHoursAmount: 0,
          },
        })

        const computation = await calculateGuardPayroll(existing.guardId, existing.month, { trx: tx })
        await persistGuardPayroll(computation, {
          trx: tx,
          actorUserId,
          setStateToCalculated: true,
        })
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.includes(LOCK_MESSAGE_FRAGMENT)) {
        return badRequest("Payroll for this month is locked. Cannot clear extra hours.")
      }
      throw err
    }

    try {
      await prisma.auditLog.create({
        data: {
          userId: actorUserId,
          event: "PAYROLL_EXTRA_HOURS_DELETE",
          module: "PAYROLL",
          description: `Cleared extra hours on payroll ${id} (guard ${existing.guardId})`,
        },
      })
    } catch (auditErr) {
      console.error("Failed to write extra-hours audit log:", auditErr)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error deleting extra hours:", error)
    return internalServerError("Failed to delete extra hours.")
  }
}

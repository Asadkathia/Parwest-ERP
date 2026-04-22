/**
 * /api/payroll/other-deductions/[id]
 *
 * The `[id]` is a Payroll row id. PATCH/DELETE manage the MISC
 * PayrollDeductionEntry attached to that payroll, then trigger a canonical
 * recalc. Locked-state errors roll back the source write.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"
import { calculateGuardPayroll } from "@/lib/payroll/calculate"
import { persistGuardPayroll } from "@/lib/payroll/persist"

const LOCK_MESSAGE_FRAGMENT = "Cannot recalculate payroll"
const MISC_CODE = "MISC"

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
    const body = await request.json()
    const amount = body.amount != null ? Number(body.amount) : undefined
    const notes: string | null | undefined =
      body.notes !== undefined ? (body.notes != null ? String(body.notes) : null) : undefined

    if (amount === undefined || !Number.isFinite(amount) || amount < 0) {
      return badRequest("amount must be a non-negative number.")
    }

    const existing = await prisma.payroll.findUnique({
      where: { id },
      select: {
        id: true,
        guardId: true,
        month: true,
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

    // Idempotent upsert of the MISC deduction type (real seeding lives elsewhere).
    const miscType = await prisma.payrollDeductionType.upsert({
      where: { code: MISC_CODE },
      update: {},
      create: {
        code: MISC_CODE,
        name: "Other Deductions",
        defaultAmount: 0,
        sortOrder: 90,
        isActive: true,
      },
    })

    const actorUserId =
      (session.user as { id?: string | null } | undefined)?.id ?? null

    let payrollId: string
    try {
      payrollId = await prisma.$transaction(async (tx) => {
        await tx.payrollDeductionEntry.upsert({
          where: {
            payrollId_deductionTypeId: {
              payrollId: existing.id,
              deductionTypeId: miscType.id,
            },
          },
          create: {
            payrollId: existing.id,
            deductionTypeId: miscType.id,
            amount,
            notes: notes ?? null,
          },
          update: {
            amount,
            ...(notes !== undefined ? { notes } : {}),
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
        return badRequest("Payroll for this month is locked. Cannot edit other deductions.")
      }
      throw err
    }

    try {
      await prisma.auditLog.create({
        data: {
          userId: actorUserId,
          event: "PAYROLL_OTHER_DEDUCTION_PATCH",
          module: "PAYROLL",
          description: `Patched MISC deduction on payroll ${id} (guard ${existing.guardId})`,
        },
      })
    } catch (auditErr) {
      console.error("Failed to write other-deductions audit log:", auditErr)
    }

    const saved = await prisma.payroll.findUnique({
      where: { id: payrollId },
      include: { guard: { select: { id: true, name: true, parwestId: true } } },
    })
    return NextResponse.json(saved)
  } catch (error) {
    console.error("Error updating other deductions:", error)
    return internalServerError("Failed to update other deductions.")
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

    const miscType = await prisma.payrollDeductionType.findUnique({
      where: { code: MISC_CODE },
      select: { id: true },
    })

    const actorUserId =
      (session.user as { id?: string | null } | undefined)?.id ?? null

    try {
      await prisma.$transaction(async (tx) => {
        if (miscType) {
          await tx.payrollDeductionEntry.deleteMany({
            where: {
              payrollId: existing.id,
              deductionTypeId: miscType.id,
            },
          })
        }

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
        return badRequest("Payroll for this month is locked. Cannot clear other deductions.")
      }
      throw err
    }

    try {
      await prisma.auditLog.create({
        data: {
          userId: actorUserId,
          event: "PAYROLL_OTHER_DEDUCTION_DELETE",
          module: "PAYROLL",
          description: `Removed MISC deduction on payroll ${id} (guard ${existing.guardId})`,
        },
      })
    } catch (auditErr) {
      console.error("Failed to write other-deductions audit log:", auditErr)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error deleting other deductions:", error)
    return internalServerError("Failed to delete other deductions.")
  }
}

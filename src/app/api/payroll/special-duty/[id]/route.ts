/**
 * @deprecated Use /api/payroll/special-duty-records/[id] instead. Legacy
 * column-write endpoint: writes Payroll.specialDutyHours/Amount directly,
 * then triggers a canonical recalc. Locked months surface as warnings (the
 * source column write is OUTSIDE the recalc tx — matches the parent legacy
 * route's pattern).
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"
import { recalcAffectedMonths } from "@/lib/payroll/special-duty-recalc"

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

    const existing = await prisma.payroll.findUnique({
      where: { id },
      select: {
        id: true,
        guardId: true,
        month: true,
        specialDutyHours: true,
        specialDutyAmount: true,
        guard: { select: { regionId: true, regionalOfficeId: true } },
      },
    })

    if (!existing) return notFound("Payroll record not found.")
    if (
      managerScope &&
      managerScopeDenied(managerScope, {
        regionId: existing.guard?.regionId ?? null,
        regionalOfficeId: existing.guard?.regionalOfficeId ?? null,
      })
    ) {
      return forbidden("Forbidden: record is outside your scope.")
    }

    const hours = body.hours != null ? Number(body.hours) : undefined
    const rate = body.rate != null ? Number(body.rate) : undefined

    const updateData: Record<string, unknown> = {}
    if (hours !== undefined) updateData.specialDutyHours = hours
    if (hours !== undefined && rate !== undefined) {
      updateData.specialDutyAmount = Number((hours * rate).toFixed(2))
    } else if (body.amount != null) {
      updateData.specialDutyAmount = Number(Number(body.amount).toFixed(2))
    }

    if (Object.keys(updateData).length === 0) {
      return badRequest("No updatable fields provided.")
    }

    const updated = await prisma.payroll.update({
      where: { id },
      data: updateData,
      include: { guard: { select: { id: true, name: true, parwestId: true } } },
    })

    const actorUserId =
      (session.user as { id?: string | null } | undefined)?.id ?? null

    // Recalc the affected month — locked months surface as warnings.
    const warnings = await recalcAffectedMonths(existing.guardId, [existing.month], actorUserId)

    try {
      await prisma.auditLog.create({
        data: {
          userId: actorUserId,
          event: "PAYROLL_SPECIAL_DUTY_LEGACY_PATCH",
          module: "PAYROLL",
          description: `Patched legacy special duty on payroll ${id} (guard ${existing.guardId})`,
        },
      })
    } catch (auditErr) {
      console.error("Failed to write special-duty audit log:", auditErr)
    }

    return NextResponse.json(warnings.length > 0 ? { ...updated, warnings } : updated)
  } catch (error) {
    console.error("Error updating special duty:", error)
    return internalServerError("Failed to update special duty.")
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
    if (!existing) return notFound("Payroll record not found.")
    if (
      managerScope &&
      managerScopeDenied(managerScope, {
        regionId: existing.guard?.regionId ?? null,
        regionalOfficeId: existing.guard?.regionalOfficeId ?? null,
      })
    ) {
      return forbidden("Forbidden: record is outside your scope.")
    }

    await prisma.payroll.update({
      where: { id },
      data: {
        specialDutyHours: 0,
        specialDutyAmount: 0,
      },
    })

    const actorUserId =
      (session.user as { id?: string | null } | undefined)?.id ?? null

    const warnings = await recalcAffectedMonths(existing.guardId, [existing.month], actorUserId)

    try {
      await prisma.auditLog.create({
        data: {
          userId: actorUserId,
          event: "PAYROLL_SPECIAL_DUTY_LEGACY_DELETE",
          module: "PAYROLL",
          description: `Cleared legacy special duty on payroll ${id} (guard ${existing.guardId})`,
        },
      })
    } catch (auditErr) {
      console.error("Failed to write special-duty audit log:", auditErr)
    }

    return NextResponse.json(warnings.length > 0 ? { ok: true, warnings } : { ok: true })
  } catch (error) {
    console.error("Error deleting special duty:", error)
    return internalServerError("Failed to delete special duty.")
  }
}

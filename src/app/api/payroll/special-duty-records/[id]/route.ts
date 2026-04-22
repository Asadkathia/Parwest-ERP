import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"
import { affectedMonthStarts, recalcAffectedMonths } from "@/lib/payroll/special-duty-recalc"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")

    const { id } = await params
    const body = await request.json()
    const existing = await prisma.payrollSpecialDuty.findUnique({ where: { id } })
    if (!existing) return notFound("Record not found.")

    const hours = body.hours != null ? Number(body.hours) : existing.hours
    const hourRate = body.hourRate != null ? Number(body.hourRate) : existing.hourRate
    const amount = Number((hours * hourRate).toFixed(2))
    const nextDateFrom = body.dateFrom ? new Date(String(body.dateFrom)) : existing.dateFrom
    const nextDateTo = body.dateTo ? new Date(String(body.dateTo)) : existing.dateTo

    const updated = await prisma.payrollSpecialDuty.update({
      where: { id },
      data: {
        dateFrom: body.dateFrom ? new Date(String(body.dateFrom)) : undefined,
        dateTo: body.dateTo ? new Date(String(body.dateTo)) : undefined,
        hours,
        hourRate,
        amount,
        comments: body.comments !== undefined ? (body.comments ? String(body.comments) : null) : undefined,
        attachmentBase64:
          body.attachmentBase64 !== undefined
            ? body.attachmentBase64
              ? String(body.attachmentBase64)
              : null
            : undefined,
        status: body.status ? String(body.status) : undefined,
      },
      include: { guard: { select: { id: true, parwestId: true, name: true } } },
    })

    // Recalc: union of months touched by old and new date ranges.
    const actorUserId =
      (session.user as { id?: string | null } | undefined)?.id ?? null
    const months = new Map<string, Date>()
    for (const m of affectedMonthStarts(existing.dateFrom, existing.dateTo)) {
      months.set(m.toISOString(), m)
    }
    for (const m of affectedMonthStarts(nextDateFrom, nextDateTo)) {
      months.set(m.toISOString(), m)
    }
    const warnings = await recalcAffectedMonths(
      existing.guardId,
      Array.from(months.values()),
      actorUserId
    )

    return NextResponse.json(warnings.length > 0 ? { ...updated, warnings } : updated)
  } catch (error) {
    console.error("Error updating special duty record:", error)
    return internalServerError("Failed to update record.")
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

    const { id } = await params
    const existing = await prisma.payrollSpecialDuty.findUnique({ where: { id } })
    if (!existing) return notFound("Record not found.")

    await prisma.payrollSpecialDuty.update({
      where: { id },
      data: { status: "CANCELLED" },
    })

    // Recalc months that the cancelled record used to contribute to.
    const actorUserId =
      (session.user as { id?: string | null } | undefined)?.id ?? null
    const warnings = await recalcAffectedMonths(
      existing.guardId,
      affectedMonthStarts(existing.dateFrom, existing.dateTo),
      actorUserId
    )

    return NextResponse.json(warnings.length > 0 ? { ok: true, warnings } : { ok: true })
  } catch (error) {
    console.error("Error deleting special duty record:", error)
    return internalServerError("Failed to delete record.")
  }
}

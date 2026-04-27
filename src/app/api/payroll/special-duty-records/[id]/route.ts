import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { affectedMonthStarts, recalcAffectedMonths } from "@/lib/payroll/special-duty-recalc"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "UPDATE")) return forbidden("Access denied.")

    const { id } = await params
    const body = await request.json()
    const existing = await prisma.payrollSpecialDuty.findUnique({
      where: { id },
      include: { guard: { select: { regionId: true, regionalOfficeId: true } } },
    })
    if (!existing) return notFound("Record not found.")
    const scope = deriveManagerScope(session)
    if (managerScopeDenied(scope, {
      regionId: existing.guard.regionId,
      regionalOfficeId: existing.guard.regionalOfficeId,
    })) {
      return notFound("Record not found.")
    }

    const hours = body.hours != null ? Number(body.hours) : existing.hours
    const hourRate = body.hourRate != null ? Number(body.hourRate) : existing.hourRate
    const amount = Number((hours * hourRate).toFixed(2))
    const nextDateFrom = body.dateFrom ? new Date(String(body.dateFrom)) : existing.dateFrom
    const nextDateTo = body.dateTo ? new Date(String(body.dateTo)) : existing.dateTo

    // clientId / branchId: undefined = no change; null/empty = clear; string = set
    let clientIdUpdate: string | null | undefined = undefined
    let branchIdUpdate: string | null | undefined = undefined
    if (body.clientId !== undefined) {
      clientIdUpdate = body.clientId ? String(body.clientId) : null
    }
    if (body.branchId !== undefined) {
      branchIdUpdate = body.branchId ? String(body.branchId) : null
    }
    const effectiveClientId =
      clientIdUpdate !== undefined ? clientIdUpdate : existing.clientId
    const effectiveBranchId =
      branchIdUpdate !== undefined ? branchIdUpdate : existing.branchId
    if (effectiveBranchId && !effectiveClientId) {
      return badRequest("clientId is required when branchId is set.")
    }
    if (clientIdUpdate) {
      const client = await prisma.client.findUnique({
        where: { id: clientIdUpdate },
        select: { id: true },
      })
      if (!client) return notFound("Client not found.")
    }
    if (effectiveBranchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: effectiveBranchId },
        select: { id: true, clientId: true },
      })
      if (!branch) return notFound("Branch not found.")
      if (branch.clientId !== effectiveClientId) {
        return badRequest("Branch does not belong to the selected client.")
      }
    }

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
        clientId: clientIdUpdate,
        branchId: branchIdUpdate,
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
    if (!hasAction(session, "PAYROLL", "DELETE")) return forbidden("Access denied.")

    const { id } = await params
    const existing = await prisma.payrollSpecialDuty.findUnique({
      where: { id },
      include: { guard: { select: { regionId: true, regionalOfficeId: true } } },
    })
    if (!existing) return notFound("Record not found.")
    const scope = deriveManagerScope(session)
    if (managerScopeDenied(scope, {
      regionId: existing.guard.regionId,
      regionalOfficeId: existing.guard.regionalOfficeId,
    })) {
      return notFound("Record not found.")
    }

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

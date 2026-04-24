/**
 * /api/payroll/other-deductions
 *
 * Manages a single PayrollDeductionEntry with deduction type code "MISC"
 * (Other Deductions). The legacy `Payroll.otherDeductions` column is no
 * longer written here directly — it is recomputed by the canonical engine.
 */

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { calculateGuardPayroll } from "@/lib/payroll/calculate"
import { persistGuardPayroll } from "@/lib/payroll/persist"

import { parseMonthStart as parseMonth } from "@/lib/payroll/date-helpers"

const LOCK_MESSAGE_FRAGMENT = "Cannot recalculate payroll"
const MISC_CODE = "MISC"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "VIEW")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { searchParams } = new URL(request.url)
    const guardId = searchParams.get("guardId") || undefined
    const monthRaw = searchParams.get("month")
    const search = searchParams.get("search") || undefined

    const payrollWhere: Prisma.PayrollWhereInput = {}
    if (guardId) payrollWhere.guardId = guardId
    if (monthRaw) {
      const month = parseMonth(monthRaw)
      if (month) payrollWhere.month = month
    }
    if (search) {
      payrollWhere.OR = [
        { guard: { name: { contains: search, mode: "insensitive" } } },
        { guard: { parwestId: { contains: search, mode: "insensitive" } } },
      ]
    }
    if (managerScope) {
      const isFilter: Record<string, unknown> = {}
      if (managerScope.regionId) isFilter.regionId = managerScope.regionId
      if (managerScope.regionalOfficeIds.length > 0) {
        isFilter.regionalOfficeId = { in: managerScope.regionalOfficeIds }
      }
      if (Object.keys(isFilter).length > 0) payrollWhere.guard = { is: isFilter }
    }

    // Find MISC deduction type id (may not yet exist).
    const miscType = await prisma.payrollDeductionType.findUnique({
      where: { code: MISC_CODE },
      select: { id: true },
    })

    const entries = miscType
      ? await prisma.payrollDeductionEntry.findMany({
          where: {
            deductionTypeId: miscType.id,
            payroll: payrollWhere,
          },
          include: {
            payroll: {
              include: {
                guard: { select: { id: true, name: true, parwestId: true } },
              },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 300,
        })
      : []

    // Shape: array of { ...payroll fields, miscAmount, notes } for backward-ish compat.
    const rows = entries.map((e) => ({
      ...e.payroll,
      otherDeductions: e.amount,
      otherDeductionNotes: e.notes,
    }))

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching other deductions:", error)
    return internalServerError("Failed to fetch other deductions records.")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "CREATE")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const body = await request.json()
    const guardId = String(body.guardId || "")
    const monthInput = String(body.month || "")
    const amount = Number(body.amount || 0)
    const notes: string | null = body.notes != null ? String(body.notes) : null

    if (!guardId || !monthInput) {
      return badRequest("guardId and month are required.")
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return badRequest("amount must be a non-negative number.")
    }

    const month = parseMonth(monthInput)
    if (!month) {
      return badRequest("Invalid month value.")
    }

    const guard = await prisma.guard.findUnique({
      where: { id: guardId },
      select: { id: true, regionId: true, regionalOfficeId: true },
    })
    if (!guard) return notFound("Guard not found.")
    if (managerScope && managerScopeDenied(managerScope, { regionId: guard.regionId, regionalOfficeId: guard.regionalOfficeId })) {
      return forbidden("Forbidden: guard is outside your scope.")
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

    const year = month.getUTCFullYear()
    const actorUserId =
      (session.user as { id?: string | null } | undefined)?.id ?? null

    let payrollId: string
    try {
      payrollId = await prisma.$transaction(async (tx) => {
        // Find or create the Payroll row.
        const existing = await tx.payroll.findUnique({
          where: { guardId_month_year: { guardId, month, year } },
          select: { id: true },
        })
        const row = existing
          ? existing
          : await tx.payroll.create({
              data: { guardId, month, year },
              select: { id: true },
            })

        // Upsert the MISC entry.
        await tx.payrollDeductionEntry.upsert({
          where: {
            payrollId_deductionTypeId: {
              payrollId: row.id,
              deductionTypeId: miscType.id,
            },
          },
          create: {
            payrollId: row.id,
            deductionTypeId: miscType.id,
            amount,
            notes,
          },
          update: {
            amount,
            notes,
          },
        })

        // Recalc.
        const computation = await calculateGuardPayroll(guardId, month, { trx: tx })
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
          event: "PAYROLL_OTHER_DEDUCTION_UPDATE",
          module: "PAYROLL",
          description: `Updated MISC deduction for guard ${guardId} month ${monthInput}`,
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
    console.error("Error saving other deductions:", error)
    return internalServerError("Failed to save other deductions.")
  }
}

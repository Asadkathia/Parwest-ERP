/**
 * /api/payroll/other-deductions
 *
 * Manages a single PayrollDeductionEntry with the canonical OTHER code
 * (manual ad-hoc deductions). The legacy `Payroll.otherDeductions` float
 * column was dropped in the deductions-policy cleanup; entries are now the
 * sole source of truth.
 *
 * Durability:
 *   The OTHER resolver falls through to `index.ts`'s default branch, which
 *   yields `computedAmount = type.defaultAmount` (= 0 for the seeded OTHER
 *   type). On non-override entries, persist.ts re-applies that 0 on every
 *   recompute — silently wiping the manually-typed amount. To keep the
 *   operator-entered value durable across recompute we flag the entry as
 *   `isOverride=true` (persist.ts:133-148 preserves `amount` for override
 *   rows). This is a SoT durability hack, NOT a permission elevation —
 *   the route remains gated by PAYROLL:CREATE (manual entry), not
 *   PAYROLL:DEDUCTION_OVERRIDE.
 */

import { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import {
  badRequest,
  forbidden,
  internalServerError,
  notFound,
  ok,
  unauthorized,
} from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { calculateGuardPayroll } from "@/lib/payroll/calculate"
import { persistGuardPayroll } from "@/lib/payroll/persist"

import { parseMonthStart as parseMonth } from "@/lib/payroll/date-helpers"

const LOCK_MESSAGE_FRAGMENT = "Cannot recalculate payroll"
// Canonical code; seeded as a policy-managed type by the deductions-policy migration.
const OTHER_CODE = "OTHER"
const OTHER_OVERRIDE_REASON = "Manual OTHER deduction (operator entry)"

function actorIdentity(session: { user?: unknown } | null): {
  id: string | null
  name: string | null
} {
  const u = (session?.user ?? null) as
    | { id?: string | null; name?: string | null; email?: string | null }
    | null
  return {
    id: u?.id ?? null,
    name: u?.name ?? u?.email ?? null,
  }
}

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
    const regionIdParam = searchParams.get("regionId")?.trim() || null
    const regionalOfficeIdParam = searchParams.get("regionalOfficeId")?.trim() || null

    if (managerScope && managerScopeDenied(managerScope, {
      regionId: regionIdParam,
      regionalOfficeId: regionalOfficeIdParam,
    })) {
      return forbidden("Forbidden: cannot query other-deductions outside your scope.")
    }

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

    const guardFilter: Record<string, unknown> = {}
    if (managerScope?.regionId) guardFilter.regionId = managerScope.regionId
    if (managerScope && managerScope.regionalOfficeIds.length > 0) {
      guardFilter.regionalOfficeId = { in: managerScope.regionalOfficeIds }
    }
    if (regionIdParam) guardFilter.regionId = regionIdParam
    if (regionalOfficeIdParam) guardFilter.regionalOfficeId = regionalOfficeIdParam
    if (Object.keys(guardFilter).length > 0) payrollWhere.guard = { is: guardFilter }

    // Find OTHER deduction type id (always seeded by the deductions-policy migration).
    const otherType = await prisma.payrollDeductionType.findUnique({
      where: { code: OTHER_CODE },
      select: { id: true },
    })

    const entries = otherType
      ? await prisma.payrollDeductionEntry.findMany({
          where: {
            deductionTypeId: otherType.id,
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

    // Shape: array of { ...payroll fields, otherDeductions, otherDeductionNotes }
    // for backward-compat with the existing PayrollOtherDeductionsManager view.
    const rows = entries.map((e) => ({
      ...e.payroll,
      otherDeductions: e.amount,
      otherDeductionNotes: e.notes,
    }))

    return ok(rows)
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

    // OTHER is seeded by the deductions-policy migration.
    const otherType = await prisma.payrollDeductionType.findUnique({
      where: { code: OTHER_CODE },
      select: { id: true },
    })
    if (!otherType) {
      return internalServerError(
        "OTHER deduction type missing — run prisma migrate to apply deductions policy."
      )
    }

    const year = month.getUTCFullYear()
    const actor = actorIdentity(session)
    const overrideAt = new Date()

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

        // Upsert the OTHER entry as an override so recompute does NOT zero
        // the operator-entered amount. The OTHER resolver yields
        // computedAmount=0 (default branch) and persist.ts preserves
        // `amount` only on rows where isOverride=true.
        await tx.payrollDeductionEntry.upsert({
          where: {
            payrollId_deductionTypeId: {
              payrollId: row.id,
              deductionTypeId: otherType.id,
            },
          },
          create: {
            payrollId: row.id,
            deductionTypeId: otherType.id,
            amount,
            notes,
            isOverride: true,
            overrideById: actor.id,
            overrideByName: actor.name,
            overrideReason: OTHER_OVERRIDE_REASON,
            overrideAt,
          },
          update: {
            amount,
            notes,
            isOverride: true,
            overrideById: actor.id,
            overrideByName: actor.name,
            overrideReason: OTHER_OVERRIDE_REASON,
            overrideAt,
          },
        })

        // Recalc.
        const computation = await calculateGuardPayroll(guardId, month, { trx: tx })
        const persisted = await persistGuardPayroll(computation, {
          trx: tx,
          actorUserId: actor.id,
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
          userId: actor.id,
          event: "PAYROLL_OTHER_DEDUCTION_UPDATE",
          module: "PAYROLL",
          description: `Updated OTHER deduction for guard ${guardId} month ${monthInput} (amount=${amount})`,
        },
      })
    } catch (auditErr) {
      console.error("Failed to write other-deductions audit log:", auditErr)
    }

    const saved = await prisma.payroll.findUnique({
      where: { id: payrollId },
      include: { guard: { select: { id: true, name: true, parwestId: true } } },
    })
    return ok(saved)
  } catch (error) {
    console.error("Error saving other deductions:", error)
    return internalServerError("Failed to save other deductions.")
  }
}

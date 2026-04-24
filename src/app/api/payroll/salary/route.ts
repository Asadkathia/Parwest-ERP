/**
 * Legacy bulk salary endpoint — delegates to the /api/payroll/calculate engine.
 * Prefer POST /api/payroll/calculate for new code.
 *
 * GET still returns Payroll rows for browse/list UIs. POST iterates the target
 * guard set (resolved via deployments in the requested month + filters) and
 * runs canonical calculate + persist for each, in a per-guard transaction.
 *
 * The legacy `finalize` flag is no longer accepted — state transitions happen
 * via /api/payroll/state/* endpoints.
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

const ALLOWED_PAYMENT_STATUSES = new Set(["PENDING", "UNPAID", "PAID"])

import { parseMonthRange } from "@/lib/payroll/date-helpers"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "VIEW")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("paymentStatus") || undefined
    const monthRaw = searchParams.get("month")
    const search = searchParams.get("search") || undefined

    const where: Prisma.PayrollWhereInput = {}
    if (status) {
      if (!ALLOWED_PAYMENT_STATUSES.has(status)) {
        return badRequest("paymentStatus must be PENDING, UNPAID, or PAID.")
      }
      where.paymentStatus = status
    }
    if (monthRaw) {
      const month = parseMonthRange(monthRaw)
      if (!month) return badRequest("Invalid month value. Use YYYY-MM or YYYY-MM-DD.")
      where.month = {
        gte: month.start,
        lt: month.end,
      }
    }
    if (search) {
      where.OR = [
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
      if (Object.keys(isFilter).length > 0) where.guard = { is: isFilter }
    }

    const rows = await prisma.payroll.findMany({
      where,
      include: {
        guard: { select: { id: true, name: true, parwestId: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching payroll salary rows:", error)
    return internalServerError("Failed to fetch salary rows.")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "CREATE")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const body = await request.json()
    const monthInput = String(body.month || "")
    const guardId = body.guardId ? String(body.guardId) : undefined
    const clientId = body.clientId ? String(body.clientId) : undefined
    const branchId = body.branchId ? String(body.branchId) : undefined
    const regionalOfficeId = body.regionalOfficeId ? String(body.regionalOfficeId) : undefined
    const regionId = body.regionId ? String(body.regionId) : undefined

    if (body.finalize !== undefined) {
      return badRequest(
        "finalize is no longer supported here. Use /api/payroll/state/lock-region instead."
      )
    }

    if (!monthInput) return badRequest("month is required.")
    const month = parseMonthRange(monthInput)
    if (!month) return badRequest("Invalid month value. Use YYYY-MM or YYYY-MM-DD.")

    if (
      managerScope &&
      managerScopeDenied(managerScope, {
        regionId: regionId || null,
        regionalOfficeId: regionalOfficeId || null,
      })
    ) {
      return forbidden("Forbidden: requested payroll calculation scope is outside your assignment.")
    }

    if (guardId) {
      const guard = await prisma.guard.findUnique({
        where: { id: guardId },
        select: { id: true, regionId: true, regionalOfficeId: true },
      })
      if (!guard) return notFound("Guard not found.")
      if (
        managerScope &&
        managerScopeDenied(managerScope, {
          regionId: guard.regionId || null,
          regionalOfficeId: guard.regionalOfficeId || null,
        })
      ) {
        return forbidden("Forbidden: guard is outside your scope.")
      }
    }

    // ---- Resolve target guard set via deployments ----------------------
    const deploymentWhere: Prisma.DeploymentWhereInput = {
      deploymentDate: { gte: month.start, lt: month.end },
      ...(guardId ? { guardId } : {}),
      ...(clientId ? { clientId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(regionalOfficeId ? { regionalOfficeId } : {}),
      ...(managerScope?.regionalOfficeIds.length
        ? { regionalOfficeId: { in: managerScope.regionalOfficeIds } }
        : {}),
      ...(regionId || managerScope?.regionId
        ? {
            guard: {
              is: {
                ...(regionId ? { regionId } : {}),
                ...(managerScope?.regionId ? { regionId: managerScope.regionId } : {}),
              },
            },
          }
        : {}),
    }

    const distinctRows = await prisma.deployment.findMany({
      where: deploymentWhere,
      distinct: ["guardId"],
      select: { guardId: true },
    })
    const guardIds = distinctRows.map((r) => r.guardId)

    if (guardIds.length === 0) {
      return NextResponse.json({
        calculated: 0,
        month: month.start.toISOString(),
        rows: [],
      })
    }

    const actorUserId =
      (session.user as { id?: string | null } | undefined)?.id ?? null

    // ---- Per-guard delegate to canonical calc + persist -----------------
    const rows: Array<Record<string, unknown>> = []
    const errors: Array<{ guardId: string; error: string }> = []

    for (const gid of guardIds) {
      try {
        const payrollId = await prisma.$transaction(async (tx) => {
          const computation = await calculateGuardPayroll(gid, month.start, { trx: tx })
          const persisted = await persistGuardPayroll(computation, {
            trx: tx,
            actorUserId,
          })
          return persisted.payrollId
        })
        const saved = await prisma.payroll.findUnique({
          where: { id: payrollId },
          include: { guard: { select: { id: true, name: true, parwestId: true } } },
        })
        if (saved) rows.push(saved as unknown as Record<string, unknown>)
      } catch (err) {
        errors.push({
          guardId: gid,
          error: err instanceof Error ? err.message : "Unknown error",
        })
      }
    }

    // Surface zero-base-salary warnings to match the prior response shape.
    const zeroSalaryGuardIds = rows
      .filter((r) => Number((r as { baseSalary?: number }).baseSalary || 0) === 0)
      .map((r) => String((r as { guardId: string }).guardId))
    let warnings: { guardId: string; name: string; parwestId: string | null; guardSalary: number | null }[] = []
    if (zeroSalaryGuardIds.length > 0) {
      const zeroGuards = await prisma.guard.findMany({
        where: { id: { in: zeroSalaryGuardIds } },
        select: { id: true, name: true, parwestId: true, salary: true },
      })
      warnings = zeroGuards.map((g) => ({
        guardId: g.id,
        name: g.name,
        parwestId: g.parwestId,
        guardSalary: g.salary,
      }))
    }

    return NextResponse.json(
      {
        calculated: rows.length,
        month: month.start.toISOString(),
        rows,
        ...(warnings.length > 0 ? { warnings } : {}),
        ...(errors.length > 0 ? { errors } : {}),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error calculating payroll salary rows:", error)
    return internalServerError("Failed to calculate payroll salary rows.")
  }
}

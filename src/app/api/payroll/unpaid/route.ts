/**
 * GET /api/payroll/unpaid
 *
 * Lists payrolls that are NOT yet PAID but ARE payable — i.e. they have
 * reached a state from which the close workflow can mark them PAID
 * (`state ∈ {REGIONAL_LOCKED, GLOBAL_FINALIZED, EMERGENCY_RELEASED}`) and
 * `paymentStatus="PENDING"`. This is the worklist for the Unpaid-Salaries
 * mark-paid screen.
 *
 * F-10 (payroll audit): this route previously filtered on
 * `paymentStatus="UNPAID"`. With the F-2 bypass closed, NOTHING in the
 * pipeline ever sets `UNPAID` — `persist.ts` only writes `PENDING`, and the
 * state machine writes `PENDING`/`PAID`. So that filter returned an
 * always-empty list. The list now keys on payable + not-yet-paid rows so the
 * page drives the canonical mark-paid path (POST /api/payroll/state/mark-paid).
 */

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

const PAYABLE_STATES = ["REGIONAL_LOCKED", "GLOBAL_FINALIZED", "EMERGENCY_RELEASED"] as const

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "VIEW")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)
    const { searchParams } = new URL(request.url)
    const monthRaw = searchParams.get("month")
    const search = searchParams.get("search") || undefined
    const regionIdParam = searchParams.get("regionId")?.trim() || null
    const regionalOfficeIdParam = searchParams.get("regionalOfficeId")?.trim() || null

    if (managerScope && managerScopeDenied(managerScope, {
      regionId: regionIdParam,
      regionalOfficeId: regionalOfficeIdParam,
    })) {
      return forbidden("Forbidden: cannot query unpaid salaries outside your scope.")
    }

    // Payable + not-yet-paid: PENDING payment status AND a state the close
    // workflow can mark PAID from. (paymentStatus is never set to UNPAID by
    // the canonical pipeline — see F-10 header note.)
    const where: Prisma.PayrollWhereInput = {
      paymentStatus: "PENDING",
      state: { in: [...PAYABLE_STATES] },
    }
    if (monthRaw) {
      const month = new Date(monthRaw)
      if (!Number.isNaN(month.getTime())) where.month = month
    }
    if (search) {
      where.OR = [
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
    if (Object.keys(guardFilter).length > 0) where.guard = { is: guardFilter }

    const rows = await prisma.payroll.findMany({
      where,
      include: {
        guard: { select: { id: true, name: true, parwestId: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching unpaid payroll:", error)
    return internalServerError("Failed to fetch unpaid salaries.")
  }
}

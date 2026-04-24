/**
 * POST /api/payroll/calculate
 *
 * Canonical payroll calculation endpoint. Computes earnings/deductions/reserve
 * for one or many guards in a given month and persists the Payroll row +
 * PayrollDeductionEntry rows. Each guard runs in its own transaction to avoid
 * lock contention on bulk runs.
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
  ok,
  unauthorized,
} from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { parseMonthRange, parseMonthStart } from "@/lib/payroll/date-helpers"
import { calculateGuardPayroll } from "@/lib/payroll/calculate"
import { persistGuardPayroll } from "@/lib/payroll/persist"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "CREATE")) return forbidden("Access denied.")
    const scope = deriveManagerScope(session)

    const body = await request.json().catch(() => ({}))
    const monthInput = String(body?.month || "")
    if (!monthInput) return badRequest("month is required (YYYY-MM).")

    const monthRange = parseMonthRange(monthInput)
    const monthStart = parseMonthStart(monthInput)
    if (!monthRange || !monthStart) {
      return badRequest("Invalid month value. Use YYYY-MM or YYYY-MM-DD.")
    }

    const guardIdSingle: string | undefined = body?.guardId ? String(body.guardId) : undefined
    const guardIdsExplicit: string[] | undefined = Array.isArray(body?.guardIds)
      ? body.guardIds.map((g: unknown) => String(g)).filter(Boolean)
      : undefined
    const regionalOfficeId: string | undefined = body?.regionalOfficeId
      ? String(body.regionalOfficeId)
      : undefined
    const regionId: string | undefined = body?.regionId ? String(body.regionId) : undefined
    const branchId: string | undefined = body?.branchId ? String(body.branchId) : undefined
    const clientId: string | undefined = body?.clientId ? String(body.clientId) : undefined
    const setStateToCalculated: boolean = body?.setStateToCalculated !== false

    // Manager-scope guard for explicit filters
    if (
      scope &&
      managerScopeDenied(scope, {
        regionId: regionId ?? null,
        regionalOfficeId: regionalOfficeId ?? null,
      })
    ) {
      return forbidden("Forbidden: requested calculation scope is outside your assignment.")
    }

    // ---- Resolve target guard set -------------------------------------
    let targetGuardIds: string[] = []
    if (guardIdSingle) {
      targetGuardIds = [guardIdSingle]
    } else if (guardIdsExplicit && guardIdsExplicit.length > 0) {
      targetGuardIds = Array.from(new Set(guardIdsExplicit))
    } else {
      // Bulk derivation via deployments
      const deploymentWhere: Prisma.DeploymentWhereInput = {
        deploymentDate: { gte: monthRange.start, lt: monthRange.end },
      }
      if (regionalOfficeId) deploymentWhere.regionalOfficeId = regionalOfficeId
      if (branchId) deploymentWhere.branchId = branchId
      if (clientId) deploymentWhere.clientId = clientId

      // Manager scope on deployments (regional office) and on guard.regionId
      const guardIs: Prisma.GuardWhereInput = {}
      if (regionId) guardIs.regionId = regionId
      if (scope?.regionId) guardIs.regionId = scope.regionId
      if (scope?.regionalOfficeIds.length) {
        deploymentWhere.regionalOfficeId = {
          in: scope.regionalOfficeIds,
        }
      }
      if (Object.keys(guardIs).length > 0) {
        deploymentWhere.guard = { is: guardIs }
      }

      const distinctRows = await prisma.deployment.findMany({
        where: deploymentWhere,
        distinct: ["guardId"],
        select: { guardId: true },
      })
      targetGuardIds = distinctRows.map((r) => r.guardId)
    }

    if (targetGuardIds.length === 0) {
      return ok({ computed: 0, results: [] })
    }

    // ---- Apply manager scope filter to explicit guard set --------------
    if (scope && (scope.regionId || scope.regionalOfficeIds.length > 0)) {
      const guardsInScope = await prisma.guard.findMany({
        where: {
          id: { in: targetGuardIds },
          ...(scope.regionId ? { regionId: scope.regionId } : {}),
          ...(scope.regionalOfficeIds.length > 0
            ? { regionalOfficeId: { in: scope.regionalOfficeIds } }
            : {}),
        },
        select: { id: true },
      })
      const allowed = new Set(guardsInScope.map((g) => g.id))
      targetGuardIds = targetGuardIds.filter((id) => allowed.has(id))
    }

    if (targetGuardIds.length === 0) {
      return ok({ computed: 0, results: [] })
    }

    // ---- Per-guard transaction loop ------------------------------------
    const results: Array<{
      guardId: string
      payrollId: string | null
      netPayable: number | null
      warnings: string[]
      error?: string
    }> = []

    const actorUserId =
      (session.user as { id?: string | null } | undefined)?.id ?? null

    for (const gid of targetGuardIds) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const calc = await calculateGuardPayroll(gid, monthStart, { trx: tx })
          const persisted = await persistGuardPayroll(calc, {
            trx: tx,
            actorUserId,
            setStateToCalculated,
          })
          return {
            guardId: gid,
            payrollId: persisted.payrollId,
            netPayable: calc.netPayable,
            warnings: calc.warnings,
          }
        })
        results.push(result)
      } catch (err) {
        results.push({
          guardId: gid,
          payrollId: null,
          netPayable: null,
          warnings: [],
          error: err instanceof Error ? err.message : "Unknown error",
        })
      }
    }

    // ---- Audit log -----------------------------------------------------
    try {
      await prisma.auditLog.create({
        data: {
          userId: actorUserId,
          event: "PAYROLL_CALCULATE",
          module: "PAYROLL",
          description: `Calculated ${results.filter((r) => r.payrollId).length} guards for month ${monthInput}`,
        },
      })
    } catch (auditErr) {
      console.error("Failed to write payroll calculate audit log:", auditErr)
    }

    return ok({
      computed: results.filter((r) => r.payrollId).length,
      results,
    })
  } catch (error) {
    console.error("Error in /api/payroll/calculate:", error)
    return internalServerError("Failed to calculate payroll.")
  }
}

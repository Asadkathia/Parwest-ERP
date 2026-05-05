/**
 * Recompute hook for retroactive rate changes.
 *
 * When a rate is approved with effectiveFrom in the past, payrolls whose month
 * falls inside the new active window need recomputation so their deduction
 * lines reflect the corrected rate.
 *
 * Behavior:
 *   - Recompute only payrolls in non-finalized states (DRAFT, CALCULATED,
 *     EMERGENCY_RELEASED). Skip REGIONAL_LOCKED / GLOBAL_FINALIZED / PAID /
 *     HOLD — those require explicit unfinalize and are recorded in the audit
 *     trail so a finance admin can act.
 *   - Recompute is invoked synchronously inside the same DB transaction as
 *     the approval, so atomicity holds: either the rate is active and all
 *     in-flight payrolls are corrected, or neither is.
 */

import type { Prisma } from "@prisma/client"
import { prisma as defaultPrisma } from "@/lib/db"
import { calculateGuardPayroll } from "@/lib/payroll/calculate"
import { persistGuardPayroll } from "@/lib/payroll/persist"
import type { RateTableName } from "./rates"

type DbClient = Prisma.TransactionClient | typeof defaultPrisma

const NON_FINALIZED_STATES = ["DRAFT", "CALCULATED", "EMERGENCY_RELEASED"]
const FINALIZED_STATES = ["REGIONAL_LOCKED", "GLOBAL_FINALIZED", "PAID", "HOLD"]

function firstOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

export type RecomputeResult = {
  recomputed: string[] // payroll ids recomputed
  blocked: { id: string; state: string; guardId: string }[] // finalized — needs manual unfinalize
}

/**
 * Find affected payrolls and recompute the non-finalized ones.
 * Scope:
 *   - ApsaaBranchRate: payrolls of guards with deployments at the branch
 *     (via Deployment.branchId)
 *   - CwfRegionRate: payrolls with regionId = scopeId
 *   - global tables: every payroll in the affected month range
 */
export async function recomputeAffectedPayrolls(
  db: DbClient,
  args: {
    table: RateTableName
    scopeId: string | null
    effectiveFrom: Date
    actorUserId: string | null
  }
): Promise<RecomputeResult> {
  const monthStart = firstOfMonthUTC(args.effectiveFrom)

  let affected: { id: string; state: string; guardId: string; month: Date }[] = []

  if (args.table === "ApsaaBranchRate" && args.scopeId) {
    affected = await db.payroll.findMany({
      where: {
        month: { gte: monthStart },
        guard: {
          deployments: { some: { branchId: args.scopeId } },
        },
      },
      select: { id: true, state: true, guardId: true, month: true },
    })
  } else if (args.table === "CwfRegionRate" && args.scopeId) {
    affected = await db.payroll.findMany({
      where: { month: { gte: monthStart }, regionId: args.scopeId },
      select: { id: true, state: true, guardId: true, month: true },
    })
  } else {
    // Global tables — affects every payroll in or after the effectiveFrom month
    affected = await db.payroll.findMany({
      where: { month: { gte: monthStart } },
      select: { id: true, state: true, guardId: true, month: true },
    })
  }

  const recomputed: string[] = []
  const blocked: RecomputeResult["blocked"] = []
  for (const p of affected) {
    if (FINALIZED_STATES.includes(p.state)) {
      blocked.push({ id: p.id, state: p.state, guardId: p.guardId })
      continue
    }
    if (!NON_FINALIZED_STATES.includes(p.state)) continue
    const computation = await calculateGuardPayroll(p.guardId, p.month, {
      trx: db as Prisma.TransactionClient,
    })
    await persistGuardPayroll(computation, {
      trx: db as Prisma.TransactionClient,
      actorUserId: args.actorUserId,
      setStateToCalculated: false, // preserve existing state
    })
    recomputed.push(p.id)
  }

  return { recomputed, blocked }
}

export { defaultPrisma as _defaultPrisma }

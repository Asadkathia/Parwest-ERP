/**
 * Recompute hook for retroactive rate changes.
 *
 * When a rate is approved with effectiveFrom in the past, payrolls whose month
 * falls inside the new active window may need recomputation so their deduction
 * lines reflect the corrected rate. Behaviour depends on whether the source
 * table is a *rate* table (resolver re-reads on every calc) or a *snapshot*
 * table (amount frozen on the ledger row at issuance time).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Rate-derived tables (recompute IS effective)
 * ─────────────────────────────────────────────────────────────────────────
 *   • `ApsaaBranchRate`  — branch-scoped; recompute payrolls of guards with
 *                          a deployment at the affected branch in the window.
 *   • `CwfRegionRate`    — region-scoped; recompute payrolls with that
 *                          regionId in the window.
 *   • `EobiRate`         — global; resolver re-gates by EobiEnrollment.isActive
 *                          at calc time, so an over-scoped recompute is safe
 *                          (un-enrolled guards short-circuit in `resolveEobi`).
 *   • `EssiRate`         — global; same as EOBI (gated by EssiEnrollment).
 *   • `ApsaaPunjabRate`  — global; resolver re-gates on `deployedInPunjab`.
 *   • `NightCallRule`    — global; resolver re-reads the rule per calc and
 *                          re-prices PENDING NightCallDeduction rows.
 *
 * For all of the above, re-running `calculate.ts` will pick up the new rate
 * via the resolver, so payrolls in the window are recomputed.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Installment-snapshot tables (recompute is a NO-OP — intentionally skipped)
 * ─────────────────────────────────────────────────────────────────────────
 *   • `UniformPlan`             — drives the issuance flow; once a
 *                                 `UniformIssuance` is created, its
 *                                 `UniformInstallment` rows have their
 *                                 `amount` written at issuance time and are
 *                                 NEVER re-priced afterwards. The resolver
 *                                 (`resolveUniform`) sums those frozen
 *                                 installment amounts; it does not re-read
 *                                 the plan. Therefore a retroactive
 *                                 UniformPlan approval does NOT change any
 *                                 existing installment, and recomputing
 *                                 payrolls would be wasted DB work.
 *   • `UniformResignationTier`  — same shape: the per-guard recovery row
 *                                 (`UniformResignationRecovery`) is created
 *                                 by the resignation hook with a snapshot
 *                                 `amount` against the tier-of-the-day; the
 *                                 resolver sums that frozen amount and never
 *                                 re-reads the tier.
 *
 * We intentionally DO NOT auto-reprice in-flight installments on retroactive
 * plan/tier changes — silently changing the contracted deduction on a guard
 * would violate the policy promise made at issuance. If finance ever needs
 * to re-price open installments, that must be an explicit, audited operation
 * (e.g. an issuance amendment), not a side-effect of approving a new rate.
 *
 * Behaviour (all branches):
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

/**
 * Tables whose values are SNAPSHOTTED onto per-guard ledger rows at issuance
 * time, so re-running calculate.ts produces an identical result. We skip the
 * payroll scan + recompute entirely to avoid wasted DB work.
 *
 * Keep this list in sync with the resolver consumption pattern: a table
 * belongs here iff its data lives on a row that the resolver reads with a
 * frozen `amount` column (not via the rate lookup). See header doc above.
 */
const SNAPSHOT_RATE_TABLES = new Set<RateTableName>([
  "UniformPlan",
  "UniformResignationTier",
])

function firstOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

export type RecomputeResult = {
  recomputed: string[] // payroll ids recomputed
  blocked: { id: string; state: string; guardId: string }[] // finalized — needs manual unfinalize
}

/**
 * Find affected payrolls and recompute the non-finalized ones.
 * Scope (rate-derived tables only — snapshot tables short-circuit above):
 *   - ApsaaBranchRate: payrolls of guards with deployments at the branch
 *     (via Deployment.branchId)
 *   - CwfRegionRate: payrolls with regionId = scopeId
 *   - EobiRate / EssiRate / ApsaaPunjabRate / NightCallRule: every payroll
 *     in the affected month range. Resolvers re-gate by
 *     enrollment/deployment/rule lookup at calc time, so the over-scope is
 *     safe — non-applicable guards short-circuit inside the resolver.
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
  // Snapshot-rate tables produce no change on recompute (amounts are frozen
  // on the issuance-time ledger row). Skip the scan + per-payroll recompute
  // entirely to avoid wasted DB work; this is a documented no-op, not a
  // silent skip. See the header doc for the snapshot-vs-rate distinction
  // and why we deliberately do NOT re-price in-flight installments.
  if (SNAPSHOT_RATE_TABLES.has(args.table)) {
    return { recomputed: [], blocked: [] }
  }

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

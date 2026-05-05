/**
 * Shared rate-table CRUD helper for the deductions policy.
 *
 * Every rate table (ApsaaBranchRate, CwfRegionRate, EobiRate, EssiRate,
 * ApsaaPunjabRate, UniformPlan, UniformResignationTier, NightCallRule)
 * uses the same propose / approve / supersede flow:
 *
 *   1. POST  → create as DRAFT (`RATE_PROPOSE`).
 *   2. PATCH /:id/approve → flip DRAFT → ACTIVE; supersede prior ACTIVE row in
 *      the same scope (`RATE_APPROVE`, with optional separation-of-duties).
 *   3. PATCH /:id/supersede → schedule replacement.
 *
 * Workflow-rule gates honoured here:
 *   - deductions.requireRateApprovalSeparation → proposer ≠ approver.
 *   - deductions.requireApprovalDocument      → sourceDocumentUrl required.
 *   - deductions.lockRetroactiveChanges       → effectiveFrom ≥ today unless RATE_RETROACTIVE.
 *
 * Every mutation writes a `DeductionPolicyAudit` row.
 */

import type { Session } from "next-auth"
import type { Prisma } from "@prisma/client"
import { prisma as defaultPrisma } from "@/lib/db"
import { hasAction } from "@/lib/api/permissions"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"
import { recomputeAffectedPayrolls } from "./recompute"

type DbClient = Prisma.TransactionClient | typeof defaultPrisma

// ─────────────────────────────────────────────────────────────────────────────
// Per-table descriptors so the helper is generic.
// ─────────────────────────────────────────────────────────────────────────────
export type RateTableName =
  | "ApsaaBranchRate"
  | "CwfRegionRate"
  | "EobiRate"
  | "EssiRate"
  | "ApsaaPunjabRate"
  | "UniformPlan"
  | "UniformResignationTier"
  | "NightCallRule"

type RateTableDescriptor = {
  // Prisma delegate name (camelCased). Returned as `keyof PrismaClient`-like
  // string; we cast on access since Prisma's typed delegates differ per model.
  delegate:
    | "apsaaBranchRate"
    | "cwfRegionRate"
    | "eobiRate"
    | "essiRate"
    | "apsaaPunjabRate"
    | "uniformPlan"
    | "uniformResignationTier"
    | "nightCallRule"
  // Field on the row that identifies the scope (null for global singletons).
  scopeField: "branchId" | "regionId" | null
  // Multi-row tier tables don't enforce a unique-active per scope (multiple
  // active rows must coexist by design). Set to false for those.
  enforceSingleActivePerScope: boolean
}

export const RATE_TABLES: Record<RateTableName, RateTableDescriptor> = {
  ApsaaBranchRate: {
    delegate: "apsaaBranchRate",
    scopeField: "branchId",
    enforceSingleActivePerScope: true,
  },
  CwfRegionRate: {
    delegate: "cwfRegionRate",
    scopeField: "regionId",
    enforceSingleActivePerScope: true,
  },
  EobiRate: {
    delegate: "eobiRate",
    scopeField: null,
    enforceSingleActivePerScope: true,
  },
  EssiRate: {
    delegate: "essiRate",
    scopeField: null,
    enforceSingleActivePerScope: true,
  },
  ApsaaPunjabRate: {
    delegate: "apsaaPunjabRate",
    scopeField: null,
    enforceSingleActivePerScope: true,
  },
  UniformPlan: {
    delegate: "uniformPlan",
    scopeField: null,
    enforceSingleActivePerScope: true,
  },
  UniformResignationTier: {
    delegate: "uniformResignationTier",
    scopeField: null,
    enforceSingleActivePerScope: false,
  },
  NightCallRule: {
    delegate: "nightCallRule",
    scopeField: null,
    enforceSingleActivePerScope: true,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────
export class RateApiError extends Error {
  constructor(
    public readonly code:
      | "FORBIDDEN"
      | "BAD_REQUEST"
      | "CONFLICT"
      | "NOT_FOUND",
    message: string
  ) {
    super(message)
    this.name = "RateApiError"
  }
}

function actor(session: Session | null | undefined): {
  id: string | null
  name: string | null
} {
  if (!session?.user) return { id: null, name: null }
  const u = session.user as { id?: string; name?: string | null }
  return { id: u.id ?? null, name: u.name ?? null }
}

// ─────────────────────────────────────────────────────────────────────────────
// List
// ─────────────────────────────────────────────────────────────────────────────
export type ListOptions = {
  scopeId?: string | null
  status?: "DRAFT" | "ACTIVE" | "SUPERSEDED" | "ALL"
}

export async function listRates(
  db: DbClient,
  session: Session | null | undefined,
  table: RateTableName,
  opts: ListOptions = {}
) {
  if (!session) throw new RateApiError("FORBIDDEN", "Unauthorized")
  if (!hasAction(session, "DEDUCTIONS", "VIEW")) {
    throw new RateApiError("FORBIDDEN", "Access denied")
  }
  const desc = RATE_TABLES[table]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (db as any)[desc.delegate]
  const where: Record<string, unknown> = {}
  if (desc.scopeField && opts.scopeId) where[desc.scopeField] = opts.scopeId
  if (opts.status && opts.status !== "ALL") where.status = opts.status
  const rows = await delegate.findMany({
    where,
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  })
  return rows
}

// ─────────────────────────────────────────────────────────────────────────────
// Propose (DRAFT)
// ─────────────────────────────────────────────────────────────────────────────
export type ProposeInput = {
  // Common to every rate table.
  amount?: number
  effectiveFrom: Date
  sourceDocumentUrl?: string | null
  notes?: string | null
  // Scoped tables:
  branchId?: string
  regionId?: string
  // UniformPlan:
  totalCost?: number
  installmentAmount?: number
  installmentCount?: number
  // UniformResignationTier:
  minMonths?: number
  maxMonths?: number
  // NightCallRule:
  callsPerNight?: number
  twoMissedDeduction?: number
  repeatedDayPenalty?: number
  consecutiveOneMissedWarningDay?: number
  consecutiveOneMissedDeductionDay?: number
  dayRateBasis?: "BASE_DIV_30" | "CUSTOM"
  customDayRate?: number | null
}

function buildCreateData(
  table: RateTableName,
  input: ProposeInput,
  proposer: { id: string | null; name: string | null }
): Record<string, unknown> {
  const desc = RATE_TABLES[table]
  const base: Record<string, unknown> = {
    effectiveFrom: input.effectiveFrom,
    status: "DRAFT",
    proposedById: proposer.id,
    proposedByName: proposer.name,
    proposedAt: new Date(),
    sourceDocumentUrl: input.sourceDocumentUrl ?? null,
    notes: input.notes ?? null,
  }

  if (desc.scopeField === "branchId") {
    if (!input.branchId) throw new RateApiError("BAD_REQUEST", "branchId required")
    base.branchId = input.branchId
  }
  if (desc.scopeField === "regionId") {
    if (!input.regionId) throw new RateApiError("BAD_REQUEST", "regionId required")
    base.regionId = input.regionId
  }

  switch (table) {
    case "UniformPlan":
      if (
        typeof input.totalCost !== "number" ||
        typeof input.installmentAmount !== "number" ||
        typeof input.installmentCount !== "number"
      ) {
        throw new RateApiError(
          "BAD_REQUEST",
          "totalCost, installmentAmount, installmentCount required"
        )
      }
      base.totalCost = input.totalCost
      base.installmentAmount = input.installmentAmount
      base.installmentCount = input.installmentCount
      break
    case "UniformResignationTier":
      if (
        typeof input.minMonths !== "number" ||
        typeof input.maxMonths !== "number" ||
        typeof input.amount !== "number"
      ) {
        throw new RateApiError(
          "BAD_REQUEST",
          "minMonths, maxMonths, amount required"
        )
      }
      if (input.minMonths < 0 || input.maxMonths <= input.minMonths) {
        throw new RateApiError(
          "BAD_REQUEST",
          "maxMonths must be greater than minMonths"
        )
      }
      base.minMonths = input.minMonths
      base.maxMonths = input.maxMonths
      base.amount = input.amount
      break
    case "NightCallRule":
      base.callsPerNight = input.callsPerNight ?? 3
      base.twoMissedDeduction = input.twoMissedDeduction ?? 1
      base.repeatedDayPenalty = input.repeatedDayPenalty ?? 1
      base.consecutiveOneMissedWarningDay = input.consecutiveOneMissedWarningDay ?? 1
      base.consecutiveOneMissedDeductionDay = input.consecutiveOneMissedDeductionDay ?? 1
      base.dayRateBasis = input.dayRateBasis ?? "BASE_DIV_30"
      base.customDayRate = input.customDayRate ?? null
      break
    default:
      // Amount-only tables: ApsaaBranchRate, CwfRegionRate, EobiRate, EssiRate, ApsaaPunjabRate
      if (typeof input.amount !== "number") {
        throw new RateApiError("BAD_REQUEST", "amount required")
      }
      base.amount = input.amount
  }
  return base
}

function isBackdated(effectiveFrom: Date): boolean {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return effectiveFrom.getTime() < today.getTime()
}

export async function proposeRate(
  db: DbClient,
  session: Session | null | undefined,
  table: RateTableName,
  input: ProposeInput
) {
  if (!session) throw new RateApiError("FORBIDDEN", "Unauthorized")
  if (!hasAction(session, "DEDUCTIONS", "RATE_PROPOSE")) {
    throw new RateApiError("FORBIDDEN", "Access denied")
  }

  if (
    isBackdated(input.effectiveFrom) &&
    isWorkflowRuleEnabled("deductions.lockRetroactiveChanges") &&
    !hasAction(session, "DEDUCTIONS", "RATE_RETROACTIVE")
  ) {
    throw new RateApiError(
      "FORBIDDEN",
      "Backdated effectiveFrom requires DEDUCTIONS:RATE_RETROACTIVE"
    )
  }

  const proposer = actor(session)
  const data = buildCreateData(table, input, proposer)
  const desc = RATE_TABLES[table]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (db as any)[desc.delegate]

  const created = await delegate.create({ data })

  await db.deductionPolicyAudit.create({
    data: {
      rateTable: table,
      rateRowId: created.id,
      action: "PROPOSED",
      scopeKey: desc.scopeField ? (created[desc.scopeField] as string) : null,
      afterJson: created as Prisma.InputJsonValue,
      byUserId: proposer.id,
      byUserName: proposer.name,
    },
  })

  return created
}

// ─────────────────────────────────────────────────────────────────────────────
// Approve (DRAFT → ACTIVE; supersedes prior ACTIVE row in same scope)
// ─────────────────────────────────────────────────────────────────────────────
export async function approveRate(
  db: DbClient,
  session: Session | null | undefined,
  table: RateTableName,
  id: string
) {
  if (!session) throw new RateApiError("FORBIDDEN", "Unauthorized")
  if (!hasAction(session, "DEDUCTIONS", "RATE_APPROVE")) {
    throw new RateApiError("FORBIDDEN", "Access denied")
  }
  const approver = actor(session)
  const desc = RATE_TABLES[table]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (db as any)[desc.delegate]

  const row = await delegate.findUnique({ where: { id } })
  if (!row) throw new RateApiError("NOT_FOUND", "Rate row not found")
  if (row.status !== "DRAFT") {
    throw new RateApiError(
      "CONFLICT",
      `Cannot approve a row in status ${row.status}`
    )
  }

  if (
    isWorkflowRuleEnabled("deductions.requireRateApprovalSeparation") &&
    row.proposedById &&
    row.proposedById === approver.id
  ) {
    throw new RateApiError(
      "FORBIDDEN",
      "Separation of duties: proposer cannot approve their own rate"
    )
  }
  if (
    isWorkflowRuleEnabled("deductions.requireApprovalDocument") &&
    !row.sourceDocumentUrl
  ) {
    throw new RateApiError(
      "BAD_REQUEST",
      "sourceDocumentUrl is required to approve this rate"
    )
  }

  // Supersede prior ACTIVE row in the same scope (when applicable).
  let supersededId: string | null = null
  if (desc.enforceSingleActivePerScope) {
    const where: Record<string, unknown> = { status: "ACTIVE" }
    if (desc.scopeField) where[desc.scopeField] = row[desc.scopeField]
    const prior = await delegate.findFirst({ where })
    if (prior) {
      await delegate.update({
        where: { id: prior.id },
        data: {
          status: "SUPERSEDED",
          effectiveTo: row.effectiveFrom,
          supersededById: approver.id,
          supersededAt: new Date(),
        },
      })
      supersededId = prior.id as string
    }
  }

  const approved = await delegate.update({
    where: { id },
    data: {
      status: "ACTIVE",
      approvedById: approver.id,
      approvedByName: approver.name,
      approvedAt: new Date(),
    },
  })

  // Retroactive recompute: if effectiveFrom is in the past, replay payrolls
  // in the affected window so their deduction lines reflect the new rate.
  // Finalized payrolls are reported as `blocked` and need manual unfinalize.
  let recomputeSummary: { recomputed: string[]; blocked: unknown[] } | null = null
  const effFrom = new Date(approved.effectiveFrom as Date)
  const todayMidnight = new Date()
  todayMidnight.setUTCHours(0, 0, 0, 0)
  if (effFrom.getTime() < todayMidnight.getTime()) {
    const result = await recomputeAffectedPayrolls(db, {
      table,
      scopeId: desc.scopeField ? (approved[desc.scopeField] as string) : null,
      effectiveFrom: effFrom,
      actorUserId: approver.id,
    })
    recomputeSummary = { recomputed: result.recomputed, blocked: result.blocked }
  }

  await db.deductionPolicyAudit.create({
    data: {
      rateTable: table,
      rateRowId: approved.id,
      action: recomputeSummary ? "RETROACTIVE_FORCED" : "APPROVED",
      scopeKey: desc.scopeField ? (approved[desc.scopeField] as string) : null,
      beforeJson: row as Prisma.InputJsonValue,
      afterJson: {
        ...(approved as object),
        ...(recomputeSummary
          ? { recomputeSummary: recomputeSummary as unknown as Prisma.InputJsonValue }
          : {}),
      } as Prisma.InputJsonValue,
      byUserId: approver.id,
      byUserName: approver.name,
      reason: [
        supersededId ? `Superseded prior ACTIVE row ${supersededId}` : null,
        recomputeSummary
          ? `Recomputed ${recomputeSummary.recomputed.length} payroll(s); blocked ${recomputeSummary.blocked.length} finalized`
          : null,
      ]
        .filter(Boolean)
        .join("; ") || null,
    },
  })

  return approved
}

// ─────────────────────────────────────────────────────────────────────────────
// Supersede (ACTIVE → SUPERSEDED; sets effectiveTo)
// ─────────────────────────────────────────────────────────────────────────────
export async function supersedeRate(
  db: DbClient,
  session: Session | null | undefined,
  table: RateTableName,
  id: string,
  effectiveTo: Date,
  reason?: string
) {
  if (!session) throw new RateApiError("FORBIDDEN", "Unauthorized")
  if (!hasAction(session, "DEDUCTIONS", "RATE_APPROVE")) {
    throw new RateApiError("FORBIDDEN", "Access denied")
  }
  const actorInfo = actor(session)
  const desc = RATE_TABLES[table]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (db as any)[desc.delegate]

  const row = await delegate.findUnique({ where: { id } })
  if (!row) throw new RateApiError("NOT_FOUND", "Rate row not found")
  if (row.status !== "ACTIVE") {
    throw new RateApiError("CONFLICT", `Cannot supersede a row in status ${row.status}`)
  }

  const updated = await delegate.update({
    where: { id },
    data: {
      status: "SUPERSEDED",
      effectiveTo,
      supersededById: actorInfo.id,
      supersededAt: new Date(),
    },
  })

  await db.deductionPolicyAudit.create({
    data: {
      rateTable: table,
      rateRowId: updated.id,
      action: "SUPERSEDED",
      scopeKey: desc.scopeField ? (updated[desc.scopeField] as string) : null,
      beforeJson: row as Prisma.InputJsonValue,
      afterJson: updated as Prisma.InputJsonValue,
      byUserId: actorInfo.id,
      byUserName: actorInfo.name,
      reason: reason ?? null,
    },
  })

  return updated
}

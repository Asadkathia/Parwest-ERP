/**
 * Generic effective-dated rate lookup.
 *
 * Every rate table follows the same shape:
 *   { id, amount, effectiveFrom, effectiveTo, status }
 *
 * For a given month, the active rate is the row with status='ACTIVE' whose
 * effectiveFrom <= monthStart AND (effectiveTo IS NULL OR effectiveTo > monthStart).
 *
 * If no row matches the engine returns `null` and the caller emits a typed
 * MISSING_RATE warning. We never silently fall back to a constant.
 */

import type { Prisma } from "@prisma/client"
import { prisma as defaultPrisma } from "@/lib/db"

type DbClient = Prisma.TransactionClient | typeof defaultPrisma

export type RateLookupResult = {
  amount: number
  rateRowId: string
} | null

type ScopedRateRow = {
  id: string
  amount: number
  effectiveFrom: Date
  effectiveTo: Date | null
  status: string
}

function pickActive(rows: ScopedRateRow[], monthStart: Date): ScopedRateRow | null {
  const ms = monthStart.getTime()
  // Prefer the most-recently-effective ACTIVE row that covers this month.
  const active = rows.filter(
    (r) =>
      r.status === "ACTIVE" &&
      r.effectiveFrom.getTime() <= ms &&
      (r.effectiveTo === null || r.effectiveTo.getTime() > ms)
  )
  if (active.length === 0) return null
  active.sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())
  return active[0]
}

function toResult(row: ScopedRateRow | null): RateLookupResult {
  if (!row) return null
  return { amount: Number(row.amount), rateRowId: row.id }
}

export async function resolveApsaaBranchRate(
  db: DbClient,
  branchId: string,
  monthStart: Date
): Promise<RateLookupResult> {
  const rows = await db.apsaaBranchRate.findMany({
    where: { branchId, status: "ACTIVE" },
    select: { id: true, amount: true, effectiveFrom: true, effectiveTo: true, status: true },
  })
  return toResult(pickActive(rows, monthStart))
}

export async function resolveCwfRegionRate(
  db: DbClient,
  regionId: string,
  monthStart: Date
): Promise<RateLookupResult> {
  const rows = await db.cwfRegionRate.findMany({
    where: { regionId, status: "ACTIVE" },
    select: { id: true, amount: true, effectiveFrom: true, effectiveTo: true, status: true },
  })
  return toResult(pickActive(rows, monthStart))
}

export async function resolveEobiRate(
  db: DbClient,
  monthStart: Date
): Promise<RateLookupResult> {
  const rows = await db.eobiRate.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, amount: true, effectiveFrom: true, effectiveTo: true, status: true },
  })
  return toResult(pickActive(rows, monthStart))
}

export async function resolveEssiRate(
  db: DbClient,
  monthStart: Date
): Promise<RateLookupResult> {
  const rows = await db.essiRate.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, amount: true, effectiveFrom: true, effectiveTo: true, status: true },
  })
  return toResult(pickActive(rows, monthStart))
}

export async function resolveApsaaPunjabRate(
  db: DbClient,
  monthStart: Date
): Promise<RateLookupResult> {
  const rows = await db.apsaaPunjabRate.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, amount: true, effectiveFrom: true, effectiveTo: true, status: true },
  })
  return toResult(pickActive(rows, monthStart))
}

export async function resolveNightCallRule(db: DbClient, monthStart: Date) {
  const rows = await db.nightCallRule.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      effectiveFrom: true,
      effectiveTo: true,
      status: true,
      callsPerNight: true,
      twoMissedDeduction: true,
      repeatedDayPenalty: true,
      consecutiveOneMissedWarningDay: true,
      consecutiveOneMissedDeductionDay: true,
      dayRateBasis: true,
      customDayRate: true,
    },
  })
  const ms = monthStart.getTime()
  const active = rows
    .filter(
      (r) =>
        r.effectiveFrom.getTime() <= ms &&
        (r.effectiveTo === null || r.effectiveTo.getTime() > ms)
    )
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())
  return active[0] ?? null
}

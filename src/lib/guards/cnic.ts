/**
 * Shared CNIC availability check for guard enrollment / edit.
 *
 * Single source of truth for the "terminated profiles don't block" re-enrollment
 * model. Used by:
 *   - POST /api/guards          (single create)
 *   - PUT  /api/guards/[id]      (CNIC change on edit)
 *   - GET  /api/guards/check-cnic (live availability probe)
 *
 * Guard.cnic is no longer `@unique` — a DB partial-unique index permits
 * multiple rows per CNIC as long as at most one is non-terminated. We inspect
 * the MOST RECENT profile for the CNIC: if it's non-terminated (ACTIVE /
 * PENDING / INACTIVE) the CNIC is taken; otherwise (most recent is TERMINATED,
 * or no profile exists at all) the CNIC is available for a brand-new profile.
 * No reactivation of the old record.
 *
 * `excludeGuardId` lets the edit path ignore the row being edited so a guard
 * keeping its own CNIC (or an edit that doesn't change the CNIC) never blocks
 * itself.
 *
 * Pure-ish: takes a Prisma-like client so it works inside or outside a
 * transaction and stays unit-test friendly.
 */

import type { Prisma, PrismaClient } from "@prisma/client"

type PrismaLike = Prisma.TransactionClient | PrismaClient

export type CnicAvailability = {
  /** A guard profile (other than the excluded one) exists for this CNIC. */
  exists: boolean
  /** lifecycleStatus of the most-recent matching profile, or null. */
  status: string | null
  /** True when a brand-new profile may be created for this CNIC. */
  available: boolean
  /**
   * Convenience inverse of `available` restricted to the profile-collision
   * case (i.e. a non-terminated profile already holds the CNIC). Does NOT
   * account for the blacklist — callers check the blacklist separately.
   */
  blockedByActiveProfile: boolean
}

/**
 * Resolve whether a CNIC is available for a new (or moved) guard profile,
 * honoring the terminated-profile re-enrollment model.
 *
 * The check is intentionally UNSCOPED: a CNIC enrolled in another region must
 * still surface as taken.
 */
export async function cnicAvailability(
  client: PrismaLike,
  cnic: string,
  options: { excludeGuardId?: string | null } = {},
): Promise<CnicAvailability> {
  const trimmed = cnic.trim()
  const excludeGuardId = options.excludeGuardId ?? null

  const latest = await client.guard.findFirst({
    where: {
      cnic: trimmed,
      ...(excludeGuardId ? { NOT: { id: excludeGuardId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, lifecycleStatus: true },
  })

  const status = latest?.lifecycleStatus ?? null
  const isTerminated = status === "TERMINATED"
  const blockedByActiveProfile = Boolean(latest) && !isTerminated
  // Available when there's no profile at all, or the most-recent one is
  // terminated (resigned / terminated).
  const available = !latest || isTerminated

  return {
    exists: Boolean(latest),
    status,
    available,
    blockedByActiveProfile,
  }
}

/**
 * Standard message for a CNIC already held by a non-terminated profile. Kept
 * here so every path surfaces an identical string.
 */
export const CNIC_ACTIVE_PROFILE_MESSAGE =
  "This guard is already enrolled and active. You cannot enroll the same CNIC again unless the previous profile is marked as Resigned or Terminated."

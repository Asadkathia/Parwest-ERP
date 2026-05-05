import type { Prisma, PrismaClient } from "@prisma/client"
import { prisma } from "@/lib/db"

/**
 * Guard lifecycle state machine.
 *
 * Two orthogonal concerns are modelled:
 *   - lifecycleStatus (stored): PENDING | ACTIVE | INACTIVE | TERMINATED
 *   - isDeployed (derived):     computed from Deployment.status = "ACTIVE"
 *
 * The legacy `status` column is kept as a dual-written shadow so non-web
 * consumers continue to see the old enum values. It is *never* authoritative
 * inside the application — always read `lifecycleStatus` (+ isDeployed when
 * the caller needs deployment state).
 *
 * All writes to status/lifecycleStatus MUST go through `applyTransition` so
 * that GuardStatusHistory is written atomically and the legacy shadow stays
 * consistent.
 */

export const LIFECYCLE_STATUSES = ["PENDING", "ACTIVE", "INACTIVE", "TERMINATED"] as const
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number]

export const TERMINATION_REASONS = ["RESIGNED", "FIRED", "ABSCONDED", "DECEASED", "OTHER"] as const
export type TerminationReason = (typeof TERMINATION_REASONS)[number]

export const LEGACY_STATUSES = ["PENDING", "ACTIVE", "PRESENT", "DEFAULT", "INACTIVE", "TERMINATED"] as const
export type LegacyStatus = (typeof LEGACY_STATUSES)[number]

export type TransitionTrigger = "MANUAL" | "SYSTEM" | "BLACKLIST" | "ENROLLMENT"

export type TransitionContext = {
  actorId?: string | null
  actorName?: string | null
  reason?: string | null
  trigger?: TransitionTrigger
  terminationReason?: TerminationReason | null
  /** When true, skips the no-held-inventory precondition on TERMINATED. */
  absconded?: boolean
}

const ALLOWED_TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  PENDING: ["ACTIVE", "TERMINATED"],
  ACTIVE: ["PENDING", "INACTIVE", "TERMINATED"],
  INACTIVE: ["ACTIVE", "TERMINATED"],
  TERMINATED: [],
}

export type TransitionCheck = { ok: true } | { ok: false; reason: string }

export function canTransition(from: LifecycleStatus, to: LifecycleStatus): TransitionCheck {
  if (from === to) return { ok: false, reason: `Guard is already ${from}` }
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    return { ok: false, reason: `Cannot transition guard from ${from} to ${to}` }
  }
  return { ok: true }
}

/**
 * Project the legacy `status` value for API responses and the dual-written
 * shadow column. Consumers on the web path should prefer reading
 * `lifecycleStatus` directly and computing `isDeployed` themselves.
 */
export function deriveLegacyStatus(lifecycle: LifecycleStatus, isDeployed: boolean): LegacyStatus {
  if (lifecycle === "ACTIVE") return isDeployed ? "PRESENT" : "DEFAULT"
  return lifecycle
}

type PrismaLike = Prisma.TransactionClient | PrismaClient

export async function isGuardDeployed(client: PrismaLike, guardId: string): Promise<boolean> {
  const count = await client.deployment.count({
    where: { guardId, status: "ACTIVE" },
  })
  return count > 0
}

/**
 * Recomputes the legacy `status` shadow for a guard given its current
 * lifecycleStatus and live deployment state. Safe to call after any
 * deployment change; idempotent.
 */
export async function syncLegacyStatus(client: PrismaLike, guardId: string): Promise<void> {
  const guard = await client.guard.findUnique({
    where: { id: guardId },
    select: { lifecycleStatus: true },
  })
  if (!guard) return
  const deployed = await isGuardDeployed(client, guardId)
  const legacy = deriveLegacyStatus(guard.lifecycleStatus as LifecycleStatus, deployed)
  await client.guard.update({
    where: { id: guardId },
    data: { status: legacy },
  })
}

export type ApplyTransitionArgs = {
  guardId: string
  to: LifecycleStatus
  ctx: TransitionContext
  /**
   * When true, active deployments are revoked (status → INACTIVE, endDate = now)
   * in the same transaction. Required when moving to INACTIVE or TERMINATED.
   * Defaults to true for INACTIVE/TERMINATED, false otherwise.
   */
  revokeDeployments?: boolean
}

export type ApplyTransitionResult = {
  fromStatus: LifecycleStatus
  toStatus: LifecycleStatus
  revokedDeployments: number
  legacyStatus: LegacyStatus
}

/**
 * Perform a guard lifecycle transition atomically.
 *
 * Writes:
 *   - Guard.lifecycleStatus, Guard.status (shadow), Guard.lifecycleStatusUpdatedAt
 *   - Guard.terminationReason (when moving to TERMINATED)
 *   - Deployment.status = "INACTIVE" for all active deployments (when revoking)
 *   - GuardStatusHistory row
 *
 * Throws on disallowed transitions or missing terminationReason.
 */
export async function applyTransition(
  client: PrismaLike,
  args: ApplyTransitionArgs
): Promise<ApplyTransitionResult> {
  const { guardId, to, ctx } = args

  const run = async (tx: Prisma.TransactionClient): Promise<ApplyTransitionResult> => {
    const guard = await tx.guard.findUnique({
      where: { id: guardId },
      select: {
        id: true,
        cnic: true,
        parwestId: true,
        name: true,
        lifecycleStatus: true,
        region: { select: { name: true } },
        regionalOffice: { select: { name: true } },
      },
    })
    if (!guard) throw new Error(`Guard ${guardId} not found`)

    const from = guard.lifecycleStatus as LifecycleStatus
    const check = canTransition(from, to)
    if (!check.ok) throw new Error(check.reason)

    if (to === "TERMINATED" && !ctx.terminationReason) {
      throw new Error("terminationReason is required when transitioning to TERMINATED")
    }

    const shouldRevoke =
      args.revokeDeployments ?? (to === "INACTIVE" || to === "TERMINATED")

    let revokedDeployments = 0
    if (shouldRevoke) {
      const revoke = await tx.deployment.updateMany({
        where: { guardId, status: "ACTIVE" },
        data: { status: "INACTIVE", endDate: new Date() },
      })
      revokedDeployments = revoke.count
    }

    const deployed = shouldRevoke ? false : await isGuardDeployed(tx, guardId)
    const legacy = deriveLegacyStatus(to, deployed)

    await tx.guard.update({
      where: { id: guardId },
      data: {
        lifecycleStatus: to,
        status: legacy,
        lifecycleStatusUpdatedAt: new Date(),
        terminationReason: to === "TERMINATED" ? ctx.terminationReason ?? null : null,
      },
    })

    await tx.guardStatusHistory.create({
      data: {
        guardId,
        cnic: guard.cnic,
        parwestId: guard.parwestId,
        guardName: guard.name,
        fromStatus: from,
        toStatus: to,
        reason: ctx.reason ?? null,
        changedByName: ctx.actorName ?? null,
        changedByType: ctx.trigger ?? "MANUAL",
        regionName: guard.region?.name ?? null,
        officeName: guard.regionalOffice?.name ?? null,
      },
    })

    // Resignation hook: TERMINATED + reason=RESIGNED triggers uniform tenure-tier
    // recovery per the canonical deductions policy. Stamps Guard.resignedOn and
    // upserts a UniformResignationRecovery row (idempotent on (guardId, month)).
    // Gated by `deductions.uniformResignationRecovery` workflow rule.
    if (to === "TERMINATED" && ctx.terminationReason === "RESIGNED") {
      const { applyResignationRecovery } = await import("@/lib/deductions/resignation")
      await applyResignationRecovery(tx, { guardId })
    }

    return {
      fromStatus: from,
      toStatus: to,
      revokedDeployments,
      legacyStatus: legacy,
    }
  }

  if ("$transaction" in client) {
    return (client as PrismaClient).$transaction((tx) => run(tx))
  }
  return run(client as Prisma.TransactionClient)
}

/**
 * Convenience wrapper for the common case where the caller holds only a
 * guardId and context — no open transaction.
 */
export async function transitionGuard(args: ApplyTransitionArgs): Promise<ApplyTransitionResult> {
  return applyTransition(prisma, args)
}

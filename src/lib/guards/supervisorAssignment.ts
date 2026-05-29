import type { Prisma } from "@prisma/client"

/**
 * Canonical terminal status for GuardSupervisorAssignment rows that are no
 * longer ACTIVE. Mirrors the `endedAt` column semantics (a row with `endedAt`
 * set has been *ended*, not merely "inactive but resumable"). All writers in
 * this codebase must use this constant so reporting / history queries can
 * filter on a single, stable value.
 */
export const GUARD_SUPERVISOR_ENDED_STATUS = "ENDED" as const

/**
 * Assign a supervisor to a guard.
 *
 * Single source of truth for GuardSupervisorAssignment writes from the
 * supervisor PATCH + switch-supervisor routes (and, eventually, the
 * guards create/update writers — see TODO(guards-route-migration) callsites).
 * It:
 *   1. Validates the supervisor user exists (throws if not — callers surface
 *      a 400 / badRequest).
 *   2. Ends (status="ENDED", endedAt=now) every prior ACTIVE assignment for
 *      the guard. Idempotent — re-running is safe; ACTIVE rows are dedup'd.
 *   3. Creates the new ACTIVE assignment and returns it.
 *
 * Must be called inside a transaction so the end+create pair is atomic.
 */
export async function assignGuardSupervisor(
  tx: Prisma.TransactionClient,
  { guardId, supervisorId }: { guardId: string; supervisorId: string },
) {
  const supervisor = await tx.user.findUnique({
    where: { id: supervisorId },
    select: { id: true },
  })
  if (!supervisor) {
    throw new Error(`Supervisor user not found: ${supervisorId}`)
  }

  await tx.guardSupervisorAssignment.updateMany({
    where: { guardId, status: "ACTIVE" },
    data: { status: GUARD_SUPERVISOR_ENDED_STATUS, endedAt: new Date() },
  })

  return tx.guardSupervisorAssignment.create({
    data: {
      guardId,
      supervisorId,
      status: "ACTIVE",
      assignedAt: new Date(),
    },
  })
}

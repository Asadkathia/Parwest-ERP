import type { Prisma } from "@prisma/client"

/**
 * Assign a supervisor to a client (optionally scoped to a branch).
 *
 * Single source of truth for ClientSupervisorAssignment writes from the client
 * create/update routes. It:
 *   1. Validates the supervisor user exists (throws if not — callers surface a 400).
 *   2. Deactivates any prior ACTIVE assignment for the same (clientId, branchId) scope.
 *   3. Creates the new ACTIVE assignment.
 *
 * Must be called inside a transaction so the deactivate+create pair is atomic.
 */
export async function assignSupervisor(
  tx: Prisma.TransactionClient,
  { clientId, branchId, supervisorId }: { clientId: string; branchId?: string | null; supervisorId: string },
): Promise<void> {
  const scopedBranchId = branchId ?? null

  const supervisor = await tx.user.findUnique({
    where: { id: supervisorId },
    select: { id: true },
  })
  if (!supervisor) {
    throw new Error(`Supervisor user not found: ${supervisorId}`)
  }

  // Deactivate prior ACTIVE assignments for the same scope (client-level vs branch-level).
  await tx.clientSupervisorAssignment.updateMany({
    where: { clientId, branchId: scopedBranchId, status: "ACTIVE" },
    data: { status: "INACTIVE" },
  })

  await tx.clientSupervisorAssignment.create({
    data: { clientId, branchId: scopedBranchId, supervisorId },
  })
}

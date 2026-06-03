import { prisma } from "@/lib/db"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"

/**
 * Branch deactivation cascade (legacy spec).
 * ─────────────────────────────────────────────────────────────────────────
 * Deactivating a branch must, in ONE transaction:
 *   1. End every ACTIVE deployment at the branch (status → INACTIVE, endDate,
 *      endReason).
 *   2. Flag the assigned inventory of the affected guards for return (gated by
 *      the `branches.cascadeOnDeactivate` workflow rule).
 *   3. Flip the branch to INACTIVE.
 *
 * The mandatory reason + effective date are recorded on each ended deployment
 * (endReason / endDate) and — authoritatively — in the audit log written by the
 * CALLER after this transaction commits. There is intentionally NO new column
 * on Branch for "deactivation reason"/"effective date": the spec is satisfied
 * via deployment.endDate + the audit record (no schema change).
 *
 * INVENTORY SCOPING CAVEAT: StoreInventoryAssignment is NOT branch-scoped — it
 * is assigned to guards / users / clients, not branches. There is also no
 * PENDING_RETURN status enum. So "flag related assigned inventory for return"
 * is implemented as: for the guards whose deployment we just ended, take their
 * still-ASSIGNED assignment rows and set expectedReturnAt = effectiveDate +
 * append a note. We do NOT change `status` (no suitable enum value) and we do
 * NOT touch client-level or user-level assignments — only the affected guards'.
 *
 * This function is pure of auth/HTTP concerns. The route handles auth, scope,
 * input validation, error→HTTP mapping, and the audit write.
 */

export type BranchDeactivationErrorCode = "NOT_FOUND" | "ALREADY_INACTIVE"

export class BranchDeactivationError extends Error {
  code: BranchDeactivationErrorCode
  constructor(code: BranchDeactivationErrorCode, message: string) {
    super(message)
    this.name = "BranchDeactivationError"
    this.code = code
  }
}

export interface DeactivateBranchArgs {
  branchId: string
  effectiveDate: Date
  reason: string
  actorId: string | null
  actorName: string
}

export interface DeactivateBranchSummary {
  endedDeployments: number
  flaggedInventory: number
  clientId: string
  regionId: string | null
}

export async function deactivateBranchWithCascade(
  args: DeactivateBranchArgs
): Promise<DeactivateBranchSummary> {
  const { branchId, effectiveDate, reason } = args
  const cascadeInventory = isWorkflowRuleEnabled("branches.cascadeOnDeactivate")

  return prisma.$transaction(async (tx) => {
    // 1. Load the branch (+ its own office region for audit enrichment — the
    //    branchful client is region-less, so client.regionId is null). (region-less)
    const branch = await tx.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        clientId: true,
        status: true,
        regionalOffice: { select: { regionId: true } },
        client: { select: { regionId: true } },
      },
    })
    if (!branch) {
      throw new BranchDeactivationError("NOT_FOUND", "Branch not found.")
    }
    if (branch.status === "INACTIVE") {
      throw new BranchDeactivationError(
        "ALREADY_INACTIVE",
        "Branch is already inactive."
      )
    }

    const regionId = branch.regionalOffice?.regionId ?? branch.client?.regionId ?? null

    // 2. Find the ACTIVE deployments at this branch so we know which guards are
    //    affected, then end them in bulk.
    const activeDeployments = await tx.deployment.findMany({
      where: { branchId, status: "ACTIVE" },
      select: { id: true, guardId: true },
    })
    const guardIds = Array.from(
      new Set(activeDeployments.map((d) => d.guardId).filter(Boolean))
    )

    let endedDeployments = 0
    if (activeDeployments.length > 0) {
      const result = await tx.deployment.updateMany({
        where: { branchId, status: "ACTIVE" },
        data: {
          status: "INACTIVE",
          endDate: effectiveDate,
          endReason: `Branch deactivated: ${reason}`,
        },
      })
      endedDeployments = result.count
    }

    // 3. Inventory reclamation (gated). Guard-scoped — see caveat above.
    //    A guard may be deployed at MULTIPLE branches; ending this branch's
    //    deployments must NOT reclaim inventory for a guard still ACTIVE
    //    elsewhere. After the updateMany above, re-query remaining ACTIVE
    //    deployments for the affected guards and only flag those with ZERO
    //    remaining active deployments (W3).
    let flaggedInventory = 0
    if (cascadeInventory && guardIds.length > 0) {
      const stillActive = await tx.deployment.findMany({
        where: { guardId: { in: guardIds }, status: "ACTIVE" },
        select: { guardId: true },
      })
      const stillActiveGuardIds = new Set(stillActive.map((d) => d.guardId))
      const reclaimGuardIds = guardIds.filter((gid) => !stillActiveGuardIds.has(gid))

      const flagNote = `Flagged for return — branch ${branchId} deactivated ${effectiveDate.toISOString()}`
      // No bulk string-append in Prisma, so we read the affected ASSIGNED rows
      // and update each to preserve any existing note.
      const assignments = reclaimGuardIds.length > 0
        ? await tx.storeInventoryAssignment.findMany({
            where: {
              assignedToGuardId: { in: reclaimGuardIds },
              status: "ASSIGNED",
            },
            select: { id: true, notes: true },
          })
        : []
      for (const assignment of assignments) {
        const nextNotes = assignment.notes
          ? `${assignment.notes}\n${flagNote}`
          : flagNote
        await tx.storeInventoryAssignment.update({
          where: { id: assignment.id },
          // Do NOT change status — no PENDING_RETURN enum exists.
          data: {
            expectedReturnAt: effectiveDate,
            notes: nextNotes,
          },
        })
      }
      flaggedInventory = assignments.length
    }

    // 4. Flip the branch to INACTIVE.
    await tx.branch.update({
      where: { id: branchId },
      data: { status: "INACTIVE" },
    })

    return {
      endedDeployments,
      flaggedInventory,
      clientId: branch.clientId,
      regionId,
    }
  })
}

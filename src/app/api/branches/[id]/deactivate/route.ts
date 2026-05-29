import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import {
  badRequest,
  conflict,
  forbidden,
  internalServerError,
  notFound,
  ok,
  unauthorized,
} from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import {
  BranchDeactivationError,
  deactivateBranchWithCascade,
} from "@/lib/branches/deactivate"

const deactivateSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required to deactivate a branch."),
  // Optional in the wire format, defaulted to now() below if absent.
  effectiveDate: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional(),
})

/**
 * POST /api/branches/[id]/deactivate
 *
 * Runs the branch deactivation cascade (see src/lib/branches/deactivate.ts):
 * ends active deployments, flags affected guards' assigned inventory for
 * return, and flips the branch to INACTIVE — all in one transaction. The
 * mandatory reason + effective date are captured on the ended deployments and
 * in the audit log written here after commit.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return unauthorized()
    }
    if (!hasAction(session, "CLIENTS", "UPDATE")) return forbidden()

    const managerScope = deriveManagerScope(session)
    const actorId = session.user?.id || null
    const actorName = session.user?.name || session.user?.email || "Unknown user"

    const { id } = await params
    const rawBody = await request.json().catch(() => ({}))

    const parsed = deactivateSchema.safeParse(rawBody)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return badRequest(first?.message || "Invalid deactivation payload.")
    }
    const reason = parsed.data.reason.trim()
    if (!reason) {
      return badRequest("A reason is required to deactivate a branch.")
    }

    // Effective date: parse to a real Date, default to now() if absent.
    let effectiveDate: Date
    const rawEffective = parsed.data.effectiveDate
    if (rawEffective === undefined || rawEffective === null || rawEffective === "") {
      effectiveDate = new Date()
    } else {
      effectiveDate = new Date(rawEffective as string | number)
      if (Number.isNaN(effectiveDate.getTime())) {
        return badRequest("Effective date is not a valid date.")
      }
    }

    // Scope check — load the branch's owning client region and deny if out of
    // scope (mirrors the PATCH handler in ../route.ts).
    const existing = await prisma.branch.findUnique({
      where: { id },
      include: { client: { select: { regionId: true } } },
    })
    if (!existing) {
      return notFound("Branch not found")
    }
    if (
      managerScope &&
      managerScopeDenied(managerScope, { regionId: existing.client?.regionId || null })
    ) {
      return forbidden("Forbidden: branch is outside your scope.")
    }

    let summary
    try {
      summary = await deactivateBranchWithCascade({
        branchId: id,
        effectiveDate,
        reason,
        actorId,
        actorName,
      })
    } catch (error: unknown) {
      if (error instanceof BranchDeactivationError) {
        if (error.code === "NOT_FOUND") return notFound("Branch not found")
        if (error.code === "ALREADY_INACTIVE") return conflict(error.message)
      }
      throw error
    }

    await safeAuditLog({
      userId: actorId,
      event: "BRANCH_DEACTIVATED",
      module: "CLIENTS",
      description: `Branch ${id} deactivated. Reason: ${reason}. Effective: ${effectiveDate.toISOString()}. Ended ${summary.endedDeployments} deployment(s), flagged ${summary.flaggedInventory} inventory item(s). By: ${actorName}`,
      targetEntityType: "Branch",
      targetEntityId: id,
      targetRegionId: summary.regionId,
    })

    return ok({
      message: "Branch deactivated.",
      endedDeployments: summary.endedDeployments,
      flaggedInventory: summary.flaggedInventory,
      clientId: summary.clientId,
      regionId: summary.regionId,
    })
  } catch (error: unknown) {
    console.error("Error deactivating branch:", error)
    return internalServerError("Failed to deactivate branch")
  }
}

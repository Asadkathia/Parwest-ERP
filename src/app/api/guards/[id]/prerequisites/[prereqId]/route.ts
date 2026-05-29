import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { requireGuardInScope } from "@/lib/guards/access"
import { transitionGuard, ActiveDeploymentTransitionError } from "@/lib/guards/lifecycle"

// GET /api/guards/[id]/prerequisites/[prereqId]
// Returns the full attachment payload for a single prerequisite (lazy fetch).
// The list endpoint omits `attachmentData` by default to keep responses small.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; prereqId: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "VIEW")) return forbidden("Access denied.")

    const { id: guardId, prereqId } = await params
    const prereq = await prisma.guardPrerequisite.findFirst({
      where: { id: prereqId, guardId },
      select: {
        id: true,
        attachmentData: true,
        attachmentName: true,
        documentUrl: true,
      },
    })
    if (!prereq) return notFound("Prerequisite record not found")

    return NextResponse.json(prereq)
  } catch (error) {
    console.error("GET /api/guards/[id]/prerequisites/[prereqId]:", error)
    return internalServerError("Failed to fetch prerequisite")
  }
}

// PATCH /api/guards/[id]/prerequisites/[prereqId]
// Admin verifies / updates a prerequisite record
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; prereqId: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "UPDATE")) return forbidden("Access denied.")

    const { id: guardId, prereqId } = await params
    const denied = await requireGuardInScope(session, guardId)
    if (denied) return denied

    const body = await request.json()

    const existing = await prisma.guardPrerequisite.findFirst({
      where: { id: prereqId, guardId },
    })
    if (!existing) return notFound("Prerequisite record not found")

    const allowedStatuses = ["PENDING", "VERIFIED", "REJECTED"]
    const allowedVerifStatuses = [
      "REQUEST_SUBMITTED",
      "REQUEST_NOT_SUBMITTED",
      "VERIFIED",
      "NON_VERIFIED",
      "LETTER_ISSUED",
      "LETTER_NOT_ISSUED",
      "FEEDBACK_RECEIVED",
      "FEEDBACK_PENDING",
    ]

    const editorName = session.user?.name ?? session.user?.email ?? "Admin"
    const data: Record<string, unknown> = {
      editedBy: editorName,
      editedAt: new Date(),
    }

    if (body.status !== undefined) {
      if (!allowedStatuses.includes(body.status)) return badRequest("Invalid status")
      data.status = body.status
      if (body.status === "VERIFIED") {
        data.verifiedAt = new Date()
        data.verifiedBy = editorName
      }
    }

    if (body.verificationStatus !== undefined) {
      if (body.verificationStatus && !allowedVerifStatuses.includes(body.verificationStatus))
        return badRequest("Invalid verificationStatus")
      data.verificationStatus = body.verificationStatus
    }

    if (body.expiryDate !== undefined)
      data.expiryDate = body.expiryDate ? new Date(body.expiryDate) : null
    if (body.comments !== undefined) data.comments = body.comments
    if (body.notes !== undefined) data.notes = body.notes

    const updated = await prisma.guardPrerequisite.update({
      where: { id: prereqId },
      data,
    })

    // Auto-flip lifecycleStatus based on VERIFICATION doc completion.
    // Only toggles between PENDING and ACTIVE — never touches INACTIVE/TERMINATED.
    try {
      const guard = await prisma.guard.findUnique({
        where: { id: guardId },
        select: { id: true, lifecycleStatus: true },
      })
      if (guard && (guard.lifecycleStatus === "PENDING" || guard.lifecycleStatus === "ACTIVE")) {
        // Get all active VERIFICATION type doc types
        const verificationDocTypes = await prisma.guardDocumentType.findMany({
          where: { isActive: true, docCategory: "VERIFICATION" },
          select: { name: true },
        })
        if (verificationDocTypes.length > 0) {
          const verificationNames = verificationDocTypes.map((dt) => dt.name)
          // Get guard's prerequisite records for these doc types
          const guardVerifPrereqs = await prisma.guardPrerequisite.findMany({
            where: { guardId, docTypeName: { in: verificationNames } },
            select: { status: true, attachmentData: true, documentUrl: true },
          })
          const allVerified =
            guardVerifPrereqs.length === verificationNames.length &&
            guardVerifPrereqs.every((p) => p.status === "VERIFIED")

          if (allVerified && guard.lifecycleStatus === "PENDING") {
            await transitionGuard({
              guardId,
              to: "ACTIVE",
              ctx: {
                trigger: "SYSTEM",
                reason: "All verification prerequisites verified",
              },
            })
          } else if (!allVerified && guard.lifecycleStatus === "ACTIVE") {
            // ACTIVE→PENDING is a non-revoking target, so applyTransition's
            // centralized precondition will throw ActiveDeploymentTransitionError
            // if the guard still holds an active deployment. We deliberately let
            // it throw (caught below) rather than silently flipping a deployed
            // guard into an inconsistent "deployed but PENDING" state.
            // TODO: gate this auto-flip behind a future
            // `guards.autoLifecycleOnVerification` workflow rule (Settings-owned).
            await transitionGuard({
              guardId,
              to: "PENDING",
              ctx: {
                trigger: "SYSTEM",
                reason: "Verification prerequisite no longer complete",
              },
            })
          }
        }
      }
    } catch (flipError) {
      // Non-critical: the prerequisite update itself succeeded. The lifecycle
      // auto-flip is best-effort. When the guard is actively deployed the
      // centralized precondition blocks the ACTIVE→PENDING flip — log and skip
      // rather than failing the request or silently corrupting state.
      if (flipError instanceof ActiveDeploymentTransitionError) {
        console.warn(
          `Skipped SYSTEM lifecycle auto-flip for guard ${guardId}: guard is actively deployed.`
        )
      } else {
        console.error(
          `SYSTEM lifecycle auto-flip failed for guard ${guardId}:`,
          flipError
        )
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/guards/[id]/prerequisites/[prereqId]:", error)
    return internalServerError("Failed to update prerequisite")
  }
}

// DELETE /api/guards/[id]/prerequisites/[prereqId]
// Remove attachment / prerequisite record
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; prereqId: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "DELETE")) return forbidden("Access denied.")

    const { id: guardId, prereqId } = await params
    const denied = await requireGuardInScope(session, guardId)
    if (denied) return denied

    const existing = await prisma.guardPrerequisite.findFirst({
      where: { id: prereqId, guardId },
    })
    if (!existing) return notFound("Prerequisite record not found")

    await prisma.guardPrerequisite.delete({ where: { id: prereqId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/guards/[id]/prerequisites/[prereqId]:", error)
    return internalServerError("Failed to delete prerequisite")
  }
}

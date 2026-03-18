import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, notFound, unauthorized } from "@/lib/api/response"

// PATCH /api/guard-age-approvals/[id] - approve or reject
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id } = await params
    const body = await request.json()

    const approval = await prisma.guardAgeApproval.findUnique({ where: { id } })
    if (!approval) return notFound("Approval request not found")
    if (approval.status !== "PENDING") return badRequest("This request has already been reviewed")

    const action = String(body.action || "").toUpperCase()
    if (!["APPROVE", "REJECT"].includes(action)) return badRequest("action must be APPROVE or REJECT")

    const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED"
    const reviewerName = session.user?.name ?? session.user?.email ?? "Admin"

    // Update approval record
    const updated = await prisma.guardAgeApproval.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedBy: reviewerName,
        reviewedAt: new Date(),
        notes: body.notes ? String(body.notes) : null,
      },
    })

    // Update guard's age approval status
    // If APPROVED → guard keeps ageApprovalRequired=true but status=APPROVED, and if guard was PENDING due to age, set to ACTIVE (if verifications also done)
    // If REJECTED → guard stays flagged as rejected, admin must manually handle
    await prisma.guard.update({
      where: { id: approval.guardId },
      data: { ageApprovalStatus: newStatus },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/guard-age-approvals/[id]:", error)
    return internalServerError("Failed to update approval")
  }
}

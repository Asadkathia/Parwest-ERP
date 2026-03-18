import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, notFound, unauthorized } from "@/lib/api/response"

// PATCH /api/guards/[id]/prerequisites/[prereqId]
// Admin verifies / updates a prerequisite record
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; prereqId: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id: guardId, prereqId } = await params
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

    const data: Record<string, unknown> = {}

    if (body.status !== undefined) {
      if (!allowedStatuses.includes(body.status)) return badRequest("Invalid status")
      data.status = body.status
      if (body.status === "VERIFIED") {
        data.verifiedAt = new Date()
        data.verifiedBy = session.user?.name ?? session.user?.email ?? "Admin"
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

    // Auto-update guard status based on VERIFICATION doc completion
    try {
      const guard = await prisma.guard.findUnique({ where: { id: guardId }, select: { id: true, status: true } })
      if (guard && (guard.status === "PENDING" || guard.status === "ACTIVE")) {
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

          if (allVerified && guard.status === "PENDING") {
            await prisma.guard.update({ where: { id: guardId }, data: { status: "ACTIVE" } })
          } else if (!allVerified && guard.status === "ACTIVE") {
            await prisma.guard.update({ where: { id: guardId }, data: { status: "PENDING" } })
          }
        }
      }
    } catch {
      // Non-critical: don't fail the request if status update fails
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

    const { id: guardId, prereqId } = await params

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

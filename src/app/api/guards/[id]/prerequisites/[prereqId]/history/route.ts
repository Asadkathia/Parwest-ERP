import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { forbidden, unauthorized, notFound, internalServerError } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

// GET /api/guards/[id]/prerequisites/[prereqId]/history
// Returns version history for a prerequisite (on-demand)
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
      select: { id: true },
    })
    if (!prereq) return notFound("Prerequisite not found")

    const history = await prisma.guardPrerequisiteHistory.findMany({
      where: { prereqId },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        attachmentData: true,
        attachmentName: true,
        documentUrl: true,
        uploadedBy: true,
        uploadedAt: true,
      },
    })

    return NextResponse.json(
      history.map((h) => ({ ...h, uploadedAt: h.uploadedAt.toISOString() }))
    )
  } catch (error) {
    console.error("GET prerequisites history:", error)
    return internalServerError("Failed to fetch history")
  }
}

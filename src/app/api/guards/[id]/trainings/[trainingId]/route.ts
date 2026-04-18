import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; trainingId: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "GUARDS")) return forbidden("Access denied.")

    const { id: guardId, trainingId } = await context.params

    await prisma.training.delete({ where: { id: trainingId, guardId } })

    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        event: "GUARD_TRAINING_DELETED",
        module: "GUARDS",
        description: `Training ${trainingId} deleted by ${session.user?.name || session.user?.email || "Unknown"}.`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") return notFound("Training not found.")
    console.error("Error deleting guard training:", error)
    return internalServerError("Failed to delete training.")
  }
}

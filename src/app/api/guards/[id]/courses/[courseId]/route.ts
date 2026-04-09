import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { internalServerError, notFound, unauthorized } from "@/lib/api/response"

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; courseId: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id: guardId, courseId } = await context.params

    await (prisma.guardCourse as unknown as {
      delete: (args: unknown) => Promise<unknown>
    }).delete({ where: { id: courseId, guardId } })

    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        event: "GUARD_COURSE_DELETED",
        module: "GUARDS",
        description: `Guard course ${courseId} deleted by ${session.user?.name || session.user?.email || "Unknown"}.`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") return notFound("Course not found.")
    console.error("Error deleting guard course:", error)
    return internalServerError("Failed to delete course.")
  }
}

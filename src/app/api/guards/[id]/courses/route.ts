import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "VIEW")) return forbidden("Access denied.")

    const { id: guardId } = await context.params

    const courses = await prisma.guardCourse.findMany({
      where: { guardId },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(courses)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "CREATE")) return forbidden("Access denied.")

    const { id: guardId } = await context.params
    const body = await request.json()

    const courseName = String(body?.courseName || "").trim()
    const courseLevel = String(body?.courseLevel || "").trim()
    const instructor = String(body?.instructor || "").trim()
    const location = String(body?.location || "").trim()
    const description = String(body?.description || "").trim() || null
    const issueDate = body?.issueDate ? new Date(body.issueDate) : null
    const fileName = String(body?.fileName || "").trim() || null
    const fileData = body?.fileData ? String(body.fileData) : null

    if (!courseName) return badRequest("Course name is required.")
    if (!courseLevel) return badRequest("Course level is required.")
    if (!instructor) return badRequest("Course instructor is required.")
    if (!location) return badRequest("Course location is required.")

    // Verify guard exists
    const guard = await prisma.guard.findUnique({
      where: { id: guardId },
      select: { id: true, parwestId: true, name: true },
    })
    if (!guard) return badRequest("Guard not found.")

    const course = await prisma.guardCourse.create({
      data: {
        guardId,
        courseName,
        courseLevel,
        instructor,
        location,
        description,
        issueDate,
        fileName,
        fileData,
        createdById: session.user?.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        event: "GUARD_COURSE_ADDED",
        module: "GUARDS",
        description: `Refresher course "${courseName}" added to guard ${guard.parwestId} (${guard.name}) by ${session.user?.name || session.user?.email || "Unknown"}.`,
      },
    })

    return NextResponse.json(course, { status: 201 })
  } catch (err: unknown) {
    console.error("Error creating guard course:", err)
    return internalServerError("Failed to add course.")
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "VIEW")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { id: guardId } = await context.params

    const guardScope = await prisma.guard.findUnique({
      where: { id: guardId },
      select: { regionId: true, regionalOfficeId: true },
    })
    if (!guardScope) return notFound("Guard not found")
    if (managerScopeDenied(managerScope, { regionId: guardScope.regionId, regionalOfficeId: guardScope.regionalOfficeId })) {
      return forbidden("Forbidden: guard is outside your scope.")
    }

    const trainings = await prisma.training.findMany({
      where: { guardId },
      orderBy: { completedAt: "desc" },
    })

    return NextResponse.json(trainings)
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
    const managerScope = deriveManagerScope(session)

    const { id: guardId } = await context.params
    const body = await request.json()

    const trainingType = String(body?.trainingType || "").trim()
    const completedAt = body?.completedAt ? new Date(body.completedAt) : null
    const instructor = String(body?.instructor || "").trim() || null
    const notes = String(body?.notes || "").trim() || null

    if (!trainingType) return badRequest("Training type is required.")
    if (!completedAt || Number.isNaN(completedAt.getTime())) return badRequest("Completed date is required.")

    const guard = await prisma.guard.findUnique({
      where: { id: guardId },
      select: { id: true, parwestId: true, name: true, regionId: true, regionalOfficeId: true },
    })
    if (!guard) return badRequest("Guard not found.")
    if (managerScopeDenied(managerScope, { regionId: guard.regionId, regionalOfficeId: guard.regionalOfficeId })) {
      return forbidden("Forbidden: guard is outside your scope.")
    }

    const training = await prisma.training.create({
      data: { guardId, trainingType, completedAt, instructor, notes },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        event: "GUARD_TRAINING_ADDED",
        module: "GUARDS",
        description: `Training "${trainingType}" added to guard ${guard.parwestId} (${guard.name}) by ${session.user?.name || session.user?.email || "Unknown"}.`,
      },
    })

    return NextResponse.json(training, { status: 201 })
  } catch (err) {
    console.error("Error creating guard training:", err)
    return internalServerError("Failed to add training.")
  }
}

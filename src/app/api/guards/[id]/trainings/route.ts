import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

const trainingCheckSchema = z.object({
  categoryId: z.string().min(1),
  completed: z.boolean(),
  notes: z.string().max(1000).optional().nullable(),
})

const postSchema = z.object({
  trainingType: z.string().min(1),
  completedAt: z.string().min(1),
  instructor: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  trainingChecks: z.array(trainingCheckSchema).optional(),
})

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
      include: {
        ojtChecks: {
          include: {
            category: { select: { id: true, name: true, sortOrder: true } },
          },
        },
      },
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
    const body = await request.json().catch(() => null)
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid payload")

    const trainingType = parsed.data.trainingType.trim()
    const completedAt = new Date(parsed.data.completedAt)
    if (Number.isNaN(completedAt.getTime())) return badRequest("Completed date is invalid.")
    const instructor = parsed.data.instructor?.trim() || null
    const notes = parsed.data.notes?.trim() || null
    const checks = parsed.data.trainingChecks ?? []

    const guard = await prisma.guard.findUnique({
      where: { id: guardId },
      select: { id: true, parwestId: true, name: true, regionId: true, regionalOfficeId: true },
    })
    if (!guard) return badRequest("Guard not found.")
    if (managerScopeDenied(managerScope, { regionId: guard.regionId, regionalOfficeId: guard.regionalOfficeId })) {
      return forbidden("Forbidden: guard is outside your scope.")
    }

    // Validate categoryIds (active + exist) in one trip
    if (checks.length > 0) {
      const ids = Array.from(new Set(checks.map((c) => c.categoryId)))
      const found = await prisma.trainingCategory.findMany({
        where: { id: { in: ids }, isActive: true },
        select: { id: true },
      })
      if (found.length !== ids.length) {
        const foundSet = new Set(found.map((f) => f.id))
        const missing = ids.filter((id) => !foundSet.has(id))
        return badRequest(`Unknown or inactive training category id(s): ${missing.join(", ")}`)
      }
    }

    // Atomic create: training + checks
    const training = await prisma.$transaction(async (tx) => {
      const created = await tx.training.create({
        data: { guardId, trainingType, completedAt, instructor, notes },
      })

      if (checks.length > 0) {
        // Use upsert per (ojtId, categoryId) — survives accidental duplicates in the payload
        await Promise.all(
          checks.map((c) =>
            tx.ojtTrainingCheck.upsert({
              where: { ojtId_categoryId: { ojtId: created.id, categoryId: c.categoryId } },
              create: {
                ojtId: created.id,
                categoryId: c.categoryId,
                completed: c.completed,
                completedAt: c.completed ? new Date() : null,
                notes: c.notes?.trim() || null,
              },
              update: {
                completed: c.completed,
                completedAt: c.completed ? new Date() : null,
                notes: c.notes?.trim() || null,
              },
            })
          )
        )
      }

      return tx.training.findUnique({
        where: { id: created.id },
        include: {
          ojtChecks: {
            include: { category: { select: { id: true, name: true, sortOrder: true } } },
          },
        },
      })
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

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

export async function GET() {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }

        const trainings = await prisma.training.findMany({
            orderBy: { completedAt: "desc" },
            include: {
                guard: {
                    select: {
                        id: true,
                        name: true,
                        parwestId: true,
                        regionalOffice: { select: { name: true } },
                    },
                },
            },
            take: 300,
        })

        return NextResponse.json(trainings)
    } catch (error: unknown) {
        console.error("Error fetching trainings:", error)
        return internalServerError("Failed to fetch trainings")
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }

        const body = await request.json()

        if (!body.guardId || !body.trainingType || !body.completedAt) {
            return badRequest("guardId, trainingType and completedAt are required")
        }

        const trainingGuard = await prisma.guard.findUnique({
            where: { id: String(body.guardId) },
            select: { id: true, regionId: true, regionalOfficeId: true },
        })
        if (!trainingGuard) {
            return notFound("Guard not found.")
        }
        const trainingScope = deriveManagerScope(session)
        if (trainingScope && managerScopeDenied(trainingScope, {
            regionId: trainingGuard.regionId,
            regionalOfficeId: trainingGuard.regionalOfficeId,
        })) {
            return forbidden("Cannot create OJT training for a guard outside your regional scope.")
        }

        const training = await prisma.training.create({
            data: {
                guardId: body.guardId,
                trainingType: body.trainingType,
                completedAt: new Date(body.completedAt),
                instructor: body.instructor || null,
                notes: body.notes || null,
            },
            include: {
                guard: {
                    select: {
                        id: true,
                        name: true,
                        parwestId: true,
                    },
                },
            },
        })

        return NextResponse.json(training, { status: 201 })
    } catch (error: unknown) {
        console.error("Error creating training:", error)
        return internalServerError("Failed to create training")
    }
}

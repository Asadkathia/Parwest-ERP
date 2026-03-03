import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, unauthorized } from "@/lib/api/response"

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

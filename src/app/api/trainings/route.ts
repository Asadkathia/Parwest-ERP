import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
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
    } catch (error: any) {
        console.error("Error fetching trainings:", error)
        return NextResponse.json({ message: "Failed to fetch trainings" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()

        if (!body.guardId || !body.trainingType || !body.completedAt) {
            return NextResponse.json(
                { message: "guardId, trainingType and completedAt are required" },
                { status: 400 }
            )
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
    } catch (error: any) {
        console.error("Error creating training:", error)
        return NextResponse.json({ message: "Failed to create training" }, { status: 500 })
    }
}

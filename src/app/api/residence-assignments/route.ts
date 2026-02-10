import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const location = searchParams.get("location")?.trim()

        const assignments = await prisma.residenceAssignment.findMany({
            where: {
                ...(location
                    ? {
                        OR: [
                            {
                                location: {
                                    contains: location,
                                    mode: "insensitive",
                                },
                            },
                            {
                                residence: {
                                    address: {
                                        contains: location,
                                        mode: "insensitive",
                                    },
                                },
                            },
                        ],
                    }
                    : {}),
            },
            orderBy: { assignedAt: "desc" },
            include: {
                guard: {
                    select: {
                        id: true,
                        parwestId: true,
                        name: true,
                        cnic: true,
                    },
                },
                residence: {
                    select: {
                        id: true,
                        address: true,
                        ownerName: true,
                        ownerPhone: true,
                        supervisor: true,
                    },
                },
            },
            take: 500,
        })

        return NextResponse.json(assignments)
    } catch (error: any) {
        console.error("Error fetching residence assignments:", error)
        return NextResponse.json(
            { message: "Failed to fetch residence assignments" },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()

        if (!body.guardId || (!body.location && !body.residenceId)) {
            return NextResponse.json(
                { message: "guardId and either location or residenceId are required" },
                { status: 400 }
            )
        }

        const assignedAt = body.assignedAt ? new Date(body.assignedAt) : new Date()
        const selectedResidence = body.residenceId
            ? await prisma.residence.findUnique({
                where: { id: body.residenceId },
                select: { id: true, address: true },
            })
            : null

        if (body.residenceId && !selectedResidence) {
            return NextResponse.json({ message: "Residence not found" }, { status: 404 })
        }

        const finalLocation = body.location || selectedResidence?.address
        if (!finalLocation) {
            return NextResponse.json({ message: "Valid location is required" }, { status: 400 })
        }

        const assignment = await prisma.residenceAssignment.upsert({
            where: {
                guardId: body.guardId,
            },
            update: {
                residenceId: selectedResidence?.id || null,
                location: finalLocation,
                assignedAt,
                notes: body.notes || null,
            },
            create: {
                guardId: body.guardId,
                residenceId: selectedResidence?.id || null,
                location: finalLocation,
                assignedAt,
                notes: body.notes || null,
            },
            include: {
                guard: {
                    select: {
                        id: true,
                        parwestId: true,
                        name: true,
                    },
                },
                residence: {
                    select: {
                        id: true,
                        address: true,
                    },
                },
            },
        })

        return NextResponse.json(assignment, { status: 200 })
    } catch (error: any) {
        console.error("Error saving residence assignment:", error)
        return NextResponse.json(
            { message: "Failed to save residence assignment" },
            { status: 500 }
        )
    }
}

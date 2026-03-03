import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, notFound, unauthorized } from "@/lib/api/response"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
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
    } catch (error: unknown) {
        console.error("Error fetching residence assignments:", error)
        return internalServerError("Failed to fetch residence assignments")
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }

        const body = await request.json()

        if (!body.guardId || (!body.location && !body.residenceId)) {
            return badRequest("guardId and either location or residenceId are required")
        }

        const assignedAt = body.assignedAt ? new Date(body.assignedAt) : new Date()
        const selectedResidence = body.residenceId
            ? await prisma.residence.findUnique({
                where: { id: body.residenceId },
                select: { id: true, address: true },
            })
            : null

        if (body.residenceId && !selectedResidence) {
            return notFound("Residence not found")
        }

        const finalLocation = body.location || selectedResidence?.address
        if (!finalLocation) {
            return badRequest("Valid location is required")
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
    } catch (error: unknown) {
        console.error("Error saving residence assignment:", error)
        return internalServerError("Failed to save residence assignment")
    }
}

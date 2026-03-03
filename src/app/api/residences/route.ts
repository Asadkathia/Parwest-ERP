import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, unauthorized } from "@/lib/api/response"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }

        const { searchParams } = new URL(request.url)
        const q = searchParams.get("q")?.trim()
        const status = searchParams.get("status")

        const residences = await prisma.residence.findMany({
            where: {
                ...(status ? { status } : {}),
                ...(q
                    ? {
                        OR: [
                            { address: { contains: q, mode: "insensitive" } },
                            { ownerName: { contains: q, mode: "insensitive" } },
                            { ownerPhone: { contains: q, mode: "insensitive" } },
                            { supervisor: { contains: q, mode: "insensitive" } },
                        ],
                    }
                    : {}),
            },
            orderBy: { createdAt: "desc" },
            include: {
                _count: {
                    select: {
                        assignments: true,
                    },
                },
            },
            take: 300,
        })

        return NextResponse.json(residences)
    } catch (error: unknown) {
        console.error("Error fetching residences:", error)
        return internalServerError("Failed to fetch residences")
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }

        const body = await request.json()

        if (!body.address) {
            return badRequest("address is required")
        }

        const residence = await prisma.residence.create({
            data: {
                address: body.address,
                ownerName: body.ownerName || null,
                ownerPhone: body.ownerPhone || null,
                supervisor: body.supervisor || null,
                capacity: body.capacity ? Number(body.capacity) : null,
                occupied: body.occupied ? Number(body.occupied) : null,
                status: body.status || "ACTIVE",
            },
        })

        return NextResponse.json(residence, { status: 201 })
    } catch (error: unknown) {
        console.error("Error creating residence:", error)
        return internalServerError("Failed to create residence")
    }
}

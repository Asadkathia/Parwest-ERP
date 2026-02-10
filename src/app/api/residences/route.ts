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
    } catch (error: any) {
        console.error("Error fetching residences:", error)
        return NextResponse.json({ message: "Failed to fetch residences" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()

        if (!body.address) {
            return NextResponse.json({ message: "address is required" }, { status: 400 })
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
    } catch (error: any) {
        console.error("Error creating residence:", error)
        return NextResponse.json({ message: "Failed to create residence" }, { status: 500 })
    }
}

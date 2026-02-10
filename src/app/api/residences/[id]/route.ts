import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params
        const body = await request.json()

        const residence = await prisma.residence.update({
            where: { id },
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

        return NextResponse.json(residence)
    } catch (error: any) {
        console.error("Error updating residence:", error)
        return NextResponse.json({ message: "Failed to update residence" }, { status: 500 })
    }
}

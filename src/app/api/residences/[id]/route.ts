import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { internalServerError, unauthorized } from "@/lib/api/response"

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
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
    } catch (error: unknown) {
        console.error("Error updating residence:", error)
        return internalServerError("Failed to update residence")
    }
}

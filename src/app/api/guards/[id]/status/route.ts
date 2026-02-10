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
        const status = body.status

        if (!status) {
            return NextResponse.json({ message: "status is required" }, { status: 400 })
        }

        const guard = await prisma.guard.update({
            where: { id },
            data: { status },
            select: { id: true, status: true, name: true, cnic: true },
        })

        return NextResponse.json(guard)
    } catch (error: any) {
        console.error("Error updating guard status:", error)
        return NextResponse.json({ message: "Failed to update guard status" }, { status: 500 })
    }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { internalServerError, notFound, unauthorized } from "@/lib/api/response"

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()

        const { id } = await params

        const guard = await prisma.guard.findUnique({
            where: { id },
            select: { id: true },
        })
        if (!guard) return notFound("Guard not found")

        const history = await prisma.guardStatusHistory.findMany({
            where: { guardId: id },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json(history)
    } catch (error) {
        console.error("Error fetching guard status history:", error)
        return internalServerError("Failed to fetch status history")
    }
}
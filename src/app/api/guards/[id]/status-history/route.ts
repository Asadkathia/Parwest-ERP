import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasAction(session, "GUARDS", "VIEW")) return forbidden("Access denied.")

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
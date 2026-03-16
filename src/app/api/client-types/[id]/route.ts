import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { internalServerError, notFound, unauthorized } from "@/lib/api/response"

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()

        const { id } = await params
        const existing = await prisma.clientType.findUnique({ where: { id }, select: { id: true } })
        if (!existing) return notFound("Client type not found.")

        await prisma.clientType.delete({ where: { id } })
        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("Error deleting client type:", error)
        return internalServerError("Failed to delete client type")
    }
}

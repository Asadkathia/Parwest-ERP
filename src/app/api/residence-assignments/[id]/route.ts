import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, notFound, unauthorized } from "@/lib/api/response"

// PATCH /api/residence-assignments/[id]
// Vacate (revoke) an active residence assignment
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()

        const { id } = await params
        const body = await request.json()

        const existing = await prisma.residenceAssignment.findUnique({ where: { id } })
        if (!existing) return notFound("Assignment not found")
        if (existing.status === "VACATED") return badRequest("Assignment is already vacated")

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sessionUser = (session as any)?.user as { name?: string; email?: string } | undefined
        const vacatedByName = sessionUser?.name ?? sessionUser?.email ?? null

        const updated = await prisma.residenceAssignment.update({
            where: { id },
            data: {
                status: "VACATED",
                vacatedAt: new Date(),
                vacatedByName,
                vacatedReason: body?.reason ? String(body.reason).trim() : null,
            },
            include: {
                guard: { select: { id: true, parwestId: true, name: true } },
                residence: { select: { id: true, address: true } },
            },
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error("PATCH /api/residence-assignments/[id]:", error)
        return internalServerError("Failed to vacate assignment")
    }
}
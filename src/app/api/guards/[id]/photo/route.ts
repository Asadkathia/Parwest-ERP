import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { requireGuardInScope } from "@/lib/guards/access"

const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB base64 limit

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasAction(session, "GUARDS", "CREATE")) return forbidden("Access denied.")

        const { id } = await params

        const denied = await requireGuardInScope(session, id)
        if (denied) return denied

        const body = await request.json()
        const photoUrl: string | null = body.photoUrl ?? null

        if (photoUrl && photoUrl.length > MAX_SIZE_BYTES) {
            return badRequest("Image is too large. Please upload an image under 1.5 MB.")
        }

        await prisma.guard.update({
            where: { id },
            data: { photoUrl },
        })

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("Error saving guard photo:", error)
        return internalServerError("Failed to save photo")
    }
}

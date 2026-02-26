import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }
        const managerScope = deriveManagerScope(session)

        const { id } = await params
        const body = await request.json()
        const status = body.status

        if (!status) {
            return NextResponse.json({ message: "status is required" }, { status: 400 })
        }

        const existingGuard = await prisma.guard.findUnique({
            where: { id },
            select: { id: true, name: true, cnic: true, status: true, regionId: true, regionalOfficeId: true },
        })
        if (!existingGuard) {
            return NextResponse.json({ message: "Guard not found" }, { status: 404 })
        }
        if (managerScope && managerScopeDenied(managerScope, { regionId: existingGuard.regionId, regionalOfficeId: existingGuard.regionalOfficeId })) {
            return NextResponse.json({ message: "Forbidden: guard is outside your scope." }, { status: 403 })
        }

        const reason = typeof body.reason === "string" ? body.reason.trim() : ""
        if (existingGuard.status === "INACTIVE" && status === "ACTIVE" && !reason) {
            return NextResponse.json({ message: "Reactivation reason is required." }, { status: 400 })
        }

        const guard = await prisma.guard.update({
            where: { id },
            data: { status },
            select: { id: true, status: true, name: true, cnic: true },
        })

        if (existingGuard.status === "INACTIVE" && status === "ACTIVE") {
            await prisma.auditLog.create({
                data: {
                    userId: session.user.id,
                    event: "GUARD_REACTIVATED",
                    module: "GUARDS",
                    description: `Guard ${existingGuard.name} (${existingGuard.cnic}) reactivated. Reason: ${reason}`,
                },
            })
        }

        return NextResponse.json(guard)
    } catch (error: any) {
        console.error("Error updating guard status:", error)
        return NextResponse.json({ message: "Failed to update guard status" }, { status: 500 })
    }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { recordGuardServiceEvent } from "@/lib/guards/service-history"
import { recordGuardStatusChange } from "@/lib/guards/status-history"

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        const managerScope = deriveManagerScope(session)

        // Only admins can manually change guard status
        const userRole = (session.user as { role?: string })?.role ?? ""
        if (userRole.toLowerCase() !== "admin") {
            return forbidden("Only admins can manually change guard status.")
        }

        const { id } = await params
        const body = await request.json()
        const status = body.status

        if (!status) {
            return badRequest("status is required")
        }

        const existingGuard = await prisma.guard.findUnique({
            where: { id },
            select: {
                id: true, name: true, cnic: true, status: true, parwestId: true,
                regionId: true, regionalOfficeId: true,
                region: { select: { name: true } },
                regionalOffice: { select: { name: true } },
            },
        })
        if (!existingGuard) {
            return notFound("Guard not found")
        }
        if (managerScope && managerScopeDenied(managerScope, { regionId: existingGuard.regionId, regionalOfficeId: existingGuard.regionalOfficeId })) {
            return forbidden("Forbidden: guard is outside your scope.")
        }

        const allowedStatuses = ["PENDING", "ACTIVE", "PRESENT", "DEFAULT", "ABSENT", "INACTIVE", "TERMINATED", "BLACKLISTED"]
        if (!allowedStatuses.includes(status)) {
            return badRequest(`Invalid status. Allowed: ${allowedStatuses.join(", ")}`)
        }

        const reason = typeof body.reason === "string" ? body.reason.trim() : ""
        if (existingGuard.status === "INACTIVE" && status === "ACTIVE" && !reason) {
            return badRequest("Reactivation reason is required.")
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

        // Determine event type
        const eventType = existingGuard.status === "INACTIVE" && status === "ACTIVE"
            ? "REACTIVATED" as const
            : "STATUS_CHANGED" as const

        const descParts = [`Status changed from ${existingGuard.status} to ${status}`]
        if (reason) descParts.push(`Reason: ${reason}`)

        void recordGuardServiceEvent({
            cnic: guard.cnic,
            guardId: guard.id,
            parwestId: existingGuard.parwestId,
            guardName: guard.name,
            event: eventType,
            fromStatus: existingGuard.status,
            toStatus: status,
            description: descParts.join(". "),
            changedByName: session.user?.name ?? session.user?.email ?? null,
            regionName: existingGuard.region?.name ?? null,
            officeName: existingGuard.regionalOffice?.name ?? null,
        })

        void recordGuardStatusChange({
            guardId: guard.id,
            cnic: guard.cnic,
            parwestId: existingGuard.parwestId,
            guardName: guard.name,
            fromStatus: existingGuard.status,
            toStatus: status,
            reason: reason || null,
            changedByName: session.user?.name ?? session.user?.email ?? null,
            changedByType: "MANUAL",
            regionName: existingGuard.region?.name ?? null,
            officeName: existingGuard.regionalOffice?.name ?? null,
        })

        return NextResponse.json(guard)
    } catch (error: unknown) {
        console.error("Error updating guard status:", error)
        return internalServerError("Failed to update guard status")
    }
}

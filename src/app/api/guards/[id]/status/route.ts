import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, conflict, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"
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
        if (!hasModuleAccess(session, "GUARDS")) return forbidden("Access denied.")
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
        const activeDeployment = await prisma.deployment.findFirst({
            where: { guardId: id, status: "ACTIVE" },
            select: { id: true, client: { select: { name: true } } },
        })
        if (activeDeployment) {
            return conflict(
                `Cannot change status of an actively deployed guard. Guard is currently deployed at ${activeDeployment.client.name}. Revoke the deployment first, then change the status.`
            )
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

        // Terminal statuses (TERMINATED / BLACKLISTED) require the guard to have
        // returned all kit and pledged documents first. The `absconded` flag is an
        // explicit escape hatch for guards who disappeared — it forfeits inventory
        // (marked LOST) and requires a reason.
        const isTerminal = status === "TERMINATED" || status === "BLACKLISTED"
        const absconded = body.absconded === true
        if (isTerminal) {
            if (absconded && !reason) {
                return badRequest("Reason is required when terminating an absconded guard.")
            }
            const [heldInventory, heldDocs] = await Promise.all([
                prisma.storeInventoryAssignment.count({
                    where: { assignedToGuardId: id, status: "ASSIGNED" },
                }),
                prisma.guardPledgedDocumentRecord.count({
                    where: { guardId: id, status: "HELD" },
                }),
            ])
            if (!absconded && (heldInventory > 0 || heldDocs > 0)) {
                const parts: string[] = []
                if (heldInventory > 0) parts.push(`${heldInventory} inventory item(s) still assigned`)
                if (heldDocs > 0) parts.push(`${heldDocs} pledged document(s) still held`)
                return conflict(
                    `Cannot terminate guard: ${parts.join(" and ")}. Run clearance first, or set absconded=true with a reason.`
                )
            }
        }

        const guard = await prisma.$transaction(async (tx) => {
            if (isTerminal && absconded) {
                await tx.storeInventoryAssignment.updateMany({
                    where: { assignedToGuardId: id, status: "ASSIGNED" },
                    data: {
                        status: "LOST",
                        returnedAt: new Date(),
                        returnedByUserId: session.user?.id ?? null,
                    },
                })
            }
            return tx.guard.update({
                where: { id },
                data: { status },
                select: { id: true, status: true, name: true, cnic: true },
            })
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
        if (isTerminal && absconded) descParts.push("Absconded (inventory forfeited as LOST)")
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

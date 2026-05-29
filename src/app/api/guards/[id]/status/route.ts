import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, conflict, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { recordGuardServiceEvent } from "@/lib/guards/service-history"
import {
    transitionGuard,
    ActiveDeploymentTransitionError,
    TERMINATION_REASONS,
    type LifecycleStatus,
    type TerminationReason,
} from "@/lib/guards/lifecycle"

// Legacy enum still accepted on the wire for backward compat with non-web consumers.
// Internally we translate into lifecycleStatus via the state machine.
const LEGACY_ACCEPTED = ["PENDING", "ACTIVE", "PRESENT", "DEFAULT", "INACTIVE", "TERMINATED"] as const

function toLifecycle(incoming: string): LifecycleStatus | null {
    switch (incoming) {
        case "PENDING": return "PENDING"
        case "ACTIVE":
        case "PRESENT":
        case "DEFAULT":
            return "ACTIVE"
        case "INACTIVE": return "INACTIVE"
        case "TERMINATED": return "TERMINATED"
        default: return null
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasAction(session, "GUARDS", "UPDATE")) return forbidden("Access denied.")
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

        if (!LEGACY_ACCEPTED.includes(status)) {
            return badRequest(`Invalid status. Allowed: ${LEGACY_ACCEPTED.join(", ")}`)
        }

        const to = toLifecycle(status)
        if (!to) {
            return badRequest(`Invalid status. Allowed: ${LEGACY_ACCEPTED.join(", ")}`)
        }

        const existingGuard = await prisma.guard.findUnique({
            where: { id },
            select: {
                id: true, name: true, cnic: true, status: true, lifecycleStatus: true, parwestId: true,
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

        const reason = typeof body.reason === "string" ? body.reason.trim() : ""
        const currentLifecycle = existingGuard.lifecycleStatus as LifecycleStatus
        if (currentLifecycle === "INACTIVE" && to === "ACTIVE" && !reason) {
            return badRequest("Reactivation reason is required.")
        }

        // TERMINATED requires a terminationReason.
        let terminationReason: TerminationReason | null = null
        if (to === "TERMINATED") {
            const incomingReason = body.terminationReason
            if (!incomingReason || !TERMINATION_REASONS.includes(incomingReason)) {
                return badRequest(
                    `terminationReason is required and must be one of: ${TERMINATION_REASONS.join(", ")}`
                )
            }
            terminationReason = incomingReason as TerminationReason
        }

        // Terminal status requires the guard to have returned all kit and pledged
        // documents first. The `absconded` flag is an explicit escape hatch for
        // guards who disappeared — it forfeits inventory (marked LOST) and requires
        // a reason.
        const isTerminal = to === "TERMINATED"
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

        // If absconded + terminal, write off held inventory as LOST before transitioning.
        if (isTerminal && absconded) {
            await prisma.storeInventoryAssignment.updateMany({
                where: { assignedToGuardId: id, status: "ASSIGNED" },
                data: {
                    status: "LOST",
                    returnedAt: new Date(),
                    returnedByUserId: session.user?.id ?? null,
                },
            })
        }

        // Atomic transition: updates lifecycleStatus + legacy shadow, writes history.
        await transitionGuard({
            guardId: id,
            to,
            ctx: {
                actorId: session.user?.id ?? null,
                actorName: session.user?.name ?? session.user?.email ?? null,
                reason: reason || null,
                trigger: "MANUAL",
                terminationReason,
                absconded,
            },
        })

        const guard = await prisma.guard.findUnique({
            where: { id },
            select: { id: true, status: true, lifecycleStatus: true, name: true, cnic: true },
        })

        if (currentLifecycle === "INACTIVE" && to === "ACTIVE") {
            await prisma.auditLog.create({
                data: {
                    userId: session.user.id,
                    event: "GUARD_REACTIVATED",
                    module: "GUARDS",
                    description: `Guard ${existingGuard.name} (${existingGuard.cnic}) reactivated. Reason: ${reason}`,
                },
            })
        }

        // Service history event
        const eventType = currentLifecycle === "INACTIVE" && to === "ACTIVE"
            ? "REACTIVATED" as const
            : "STATUS_CHANGED" as const

        const descParts = [`Status changed from ${existingGuard.status} to ${guard?.status ?? status}`]
        if (isTerminal && absconded) descParts.push("Absconded (inventory forfeited as LOST)")
        if (terminationReason) descParts.push(`Termination reason: ${terminationReason}`)
        if (reason) descParts.push(`Reason: ${reason}`)

        void recordGuardServiceEvent({
            cnic: existingGuard.cnic,
            guardId: existingGuard.id,
            parwestId: existingGuard.parwestId,
            guardName: existingGuard.name,
            event: eventType,
            fromStatus: existingGuard.status,
            toStatus: guard?.status ?? status,
            description: descParts.join(". "),
            changedByName: session.user?.name ?? session.user?.email ?? null,
            regionName: existingGuard.region?.name ?? null,
            officeName: existingGuard.regionalOffice?.name ?? null,
        })

        return NextResponse.json(guard)
    } catch (error: unknown) {
        // The active-deployment precondition is now enforced centrally inside
        // applyTransition (lib/guards/lifecycle.ts) so every lifecycle writer
        // shares one rule. Translate that sentinel into the same 409 the inline
        // guard used to return, enriched with the deployment's client name.
        if (error instanceof ActiveDeploymentTransitionError) {
            const { id } = await params
            const activeDeployment = await prisma.deployment.findFirst({
                where: { guardId: id, status: "ACTIVE" },
                select: { client: { select: { name: true } } },
            })
            const where = activeDeployment?.client?.name
                ? ` Guard is currently deployed at ${activeDeployment.client.name}.`
                : ""
            return conflict(
                `Cannot change status of an actively deployed guard.${where} Revoke the deployment first, then change the status.`
            )
        }
        console.error("Error updating guard status:", error)
        const message = error instanceof Error ? error.message : "Failed to update guard status"
        return internalServerError(message)
    }
}

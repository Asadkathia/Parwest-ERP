import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { conflict, forbidden, internalServerError, notFound, ok, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { syncLegacyStatus } from "@/lib/guards/lifecycle"

// Deployments are read-only — only revoke (DELETE here, or POST /end) is permitted (Ticket 37).
// PATCH was removed; the prior /change route was also removed.
// DELETE and POST /[id]/end share the same transactional end logic: update +
// syncLegacyStatus + re-read in one $transaction, GuardStatusHistory written on
// projected status change, and one "already ended" rule (status === INACTIVE).

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasAction(session, "GUARDS", "DELETE")) return forbidden("Access denied.")
        const managerScope = deriveManagerScope(session)

        const { id } = await params

        const existing = await prisma.deployment.findUnique({
            where: { id },
            select: { id: true, status: true, regionalOfficeId: true, guardId: true },
        })
        if (!existing) {
            return notFound("Deployment not found")
        }
        if (managerScope && managerScopeDenied(managerScope, { regionalOfficeId: existing.regionalOfficeId })) {
            return forbidden("Forbidden: deployment is outside your scope.")
        }
        // "Already ended" guard — same rule as POST /end (single source of truth).
        if (existing.status === "INACTIVE") {
            return conflict("Deployment is already ended.")
        }

        const revokedByName = (session.user as { name?: string })?.name ?? null

        // End the deployment + recompute the legacy guard-status shadow atomically.
        // Mirrors POST /[id]/end exactly so both end paths are transactional and
        // both write GuardStatusHistory when the projected guard status changes.
        // NOTE: syncLegacyStatus is the deployment→legacy-status projection — it
        // recomputes Guard.status from live deployment state. Ending a deployment
        // is NOT a guard lifecycle transition (the guard stays ACTIVE/undeployed),
        // so this deliberately does NOT route through applyTransition.
        const { deployment, guardStatusChanged, prevGuardStatus, newGuardStatus } = await prisma.$transaction(async (tx) => {
            const updated = await tx.deployment.update({
                where: { id },
                data: {
                    status: "INACTIVE",
                    endDate: new Date(),
                    revokedByName,
                },
                include: {
                    guard: { select: { id: true, name: true, cnic: true, parwestId: true, status: true } },
                    client: { select: { id: true, name: true } },
                    branch: true,
                    regionalOffice: { select: { id: true, name: true } },
                },
            })

            const guardId = updated.guard.id
            const prev = updated.guard.status
            await syncLegacyStatus(tx, guardId)
            const refreshed = await tx.guard.findUnique({
                where: { id: guardId },
                select: { status: true },
            })
            const next = refreshed?.status ?? prev
            const changed = next !== prev

            return { deployment: updated, guardStatusChanged: changed, prevGuardStatus: prev, newGuardStatus: next }
        })

        // Record status-history outside the transaction (non-critical audit side-effect)
        if (guardStatusChanged) {
            const { recordGuardStatusChange } = await import("@/lib/guards/status-history")
            void recordGuardStatusChange({
                guardId: deployment.guard.id,
                cnic: deployment.guard.cnic,
                parwestId: deployment.guard.parwestId,
                guardName: deployment.guard.name,
                fromStatus: prevGuardStatus,
                toStatus: newGuardStatus,
                reason: `Deployment at ${deployment.client.name} ended`,
                changedByName: revokedByName,
                changedByType: "SYSTEM",
                officeName: deployment.regionalOffice?.name ?? null,
            })
        }

        return ok({ message: "Deployment ended successfully", deployment })
    } catch (error: unknown) {
        console.error("Error ending deployment:", error)
        return internalServerError("Failed to end deployment")
    }
}

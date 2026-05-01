import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { conflict, forbidden, internalServerError, notFound, ok, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"
import { syncLegacyStatus } from "@/lib/guards/lifecycle"

// Deployments are read-only — only revoke (DELETE here, or POST /end) is permitted (Ticket 37).
// PATCH was removed; the prior /change route was also removed.

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
        if (
            isWorkflowRuleEnabled("deployments.blockInactiveUpdate") &&
            existing.status !== "ACTIVE"
        ) {
            return conflict("Deployment is already ended.")
        }

        const deployment = await prisma.deployment.update({
            where: { id },
            data: {
                status: "INACTIVE",
                endDate: new Date(),
            },
        })

        await syncLegacyStatus(prisma, existing.guardId)

        return ok({ message: "Deployment ended successfully", deployment })
    } catch (error: unknown) {
        console.error("Error ending deployment:", error)
        return internalServerError("Failed to end deployment")
    }
}

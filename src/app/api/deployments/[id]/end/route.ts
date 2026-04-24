import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, conflict, forbidden, internalServerError, notFound, ok, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"
import { syncLegacyStatus } from "@/lib/guards/lifecycle"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasAction(session, "GUARDS", "CREATE")) return forbidden("Access denied.")
        const managerScope = deriveManagerScope(session)

        const { id } = await params
        const body = await request.json()

        // Validate deployment exists and is active
        const existingDeployment = await prisma.deployment.findUnique({
            where: { id },
            select: {
                id: true,
                status: true,
                regionalOfficeId: true,
                deploymentDate: true,
            },
        })

        if (!existingDeployment) {
            return notFound("Deployment not found")
        }
        if (managerScope && managerScopeDenied(managerScope, { regionalOfficeId: existingDeployment.regionalOfficeId })) {
            return forbidden("Forbidden: deployment is outside your scope.")
        }

        if (existingDeployment.status === "INACTIVE") {
            return conflict("Deployment is already ended.")
        }

        // Validate end date
        if (isWorkflowRuleEnabled("deployments.requireEndDate") && !body?.endDate) {
            return badRequest("endDate is required.")
        }

        const endDate = body?.endDate ? new Date(String(body.endDate)) : new Date()
        if (Number.isNaN(endDate.getTime())) {
            return badRequest("Invalid endDate value.")
        }
        const deploymentDate = new Date(existingDeployment.deploymentDate)
        const today = new Date()

        // Normalize dates to compare only the date part (ignore time)
        const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
        const deploymentDateOnly = new Date(deploymentDate.getFullYear(), deploymentDate.getMonth(), deploymentDate.getDate())
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

        if (isWorkflowRuleEnabled("deployments.disallowEndDateBeforeDeploymentDate") && endDateOnly < deploymentDateOnly) {
            return badRequest("End date cannot be before deployment date")
        }

        if (isWorkflowRuleEnabled("deployments.disallowFutureEndDate") && endDateOnly > todayOnly) {
            return badRequest("End date cannot be in the future")
        }

        const revokedByName = (session.user as { name?: string })?.name ?? null

        // End the deployment + recompute guard status atomically
        const { deployment, guardStatusChanged, prevGuardStatus, newGuardStatus } = await prisma.$transaction(async (tx) => {
            const updated = await tx.deployment.update({
                where: { id },
                data: {
                    status: "INACTIVE",
                    endDate: endDate,
                    endReason: body.reason || null,
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

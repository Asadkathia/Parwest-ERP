import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; contractId: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        const { id: clientId, contractId } = await params

        const managerScope = deriveManagerScope(session)
        if (managerScope) {
            const client = await prisma.client.findUnique({
                where: { id: clientId },
                select: { regionId: true, regionalOfficeId: true },
            })
            if (!client) return notFound("Client not found.")
            if (managerScopeDenied(managerScope, { regionId: client.regionId, regionalOfficeId: client.regionalOfficeId })) {
                return forbidden("Access denied.")
            }
        }

        const rawActorId = session.user?.id || null
        const actorName = session.user?.name || session.user?.email || rawActorId || "Unknown"
        const actorId = rawActorId
            ? (await prisma.user.findUnique({ where: { id: rawActorId }, select: { id: true } }))?.id ?? null
            : null

        const body = await request.json()
        const contract = await prisma.clientContract.findUnique({ where: { id: contractId } })
        if (!contract) return notFound("Contract not found")

        const name = body?.name ? String(body.name).trim() : contract.name
        if (!name) return badRequest("Contract name is required.")

        const updated = await prisma.clientContract.update({
            where: { id: contractId },
            data: {
                name,
                type: body?.type ? String(body.type).toUpperCase() : contract.type,
                startDate: body?.startDate ? new Date(body.startDate) : contract.startDate,
                endDate: body?.endDate ? new Date(body.endDate) : contract.endDate,
                isActive: body?.isActive !== undefined ? Boolean(body.isActive) : contract.isActive,
            },
            include: {
                branch: { select: { id: true, name: true } },
                rates: { orderBy: [{ guardType: "asc" }, { createdAt: "asc" }] },
            },
        })

        await prisma.auditLog
            .create({
                data: {
                    userId: actorId,
                    event: "CONTRACT_UPDATED",
                    module: "CLIENTS",
                    description: `Contract "${name}" (${contractId}) updated for client ${clientId}. By: ${actorName}`,
                },
            })
            .catch((e) => console.warn("AuditLog create failed (non-critical):", e))

        return NextResponse.json(updated)
    } catch (error) {
        console.error("Error updating contract:", error)
        return internalServerError("Failed to update contract")
    }
}

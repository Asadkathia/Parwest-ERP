import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, ok, unauthorized } from "@/lib/api/response"

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
        const actorId = session.user?.id || null

        const { id } = await params
        const body = await request.json()
        const name = String(body?.name || "").trim()
        if (!name) {
            return badRequest("name is required.")
        }

        if (managerScope) {
            const existing = await prisma.branch.findUnique({
                where: { id },
                include: { client: { select: { regionId: true } } },
            })
            if (!existing) {
                return notFound("Branch not found")
            }
            if (managerScopeDenied(managerScope, { regionId: existing.client?.regionId || null })) {
                return forbidden("Forbidden: branch is outside your scope.")
            }

            if (body?.clientId) {
                const targetClient = await prisma.client.findUnique({
                    where: { id: String(body.clientId) },
                    select: { regionId: true },
                })
                if (!targetClient) {
                    return notFound("Target client not found")
                }
                if (managerScopeDenied(managerScope, { regionId: targetClient.regionId })) {
                    return forbidden("Forbidden: cannot move branch outside your scope.")
                }
            }
        }

        const targetClientId = body?.clientId ? String(body.clientId) : undefined
        const branch = await prisma.$transaction(async (tx) => {
            const updated = await tx.branch.update({
                where: { id },
                data: {
                    clientId: targetClientId || undefined,
                    name,
                    code: body?.code ? String(body.code).trim() : null,
                    address: body?.address ? String(body.address) : null,
                    city: body?.city ? String(body.city) : null,
                    province: body?.province ? String(body.province) : null,
                    contactPerson: body?.contactPerson ? String(body.contactPerson) : null,
                    contactPhone: body?.contactPhone ? String(body.contactPhone) : null,
                    contactEmail: body?.contactEmail ? String(body.contactEmail) : null,
                    isHeadOffice: body?.isHeadOffice === true,
                },
                include: {
                    client: true,
                },
            })

            await tx.auditLog.create({
                data: {
                    userId: actorId,
                    event: "BRANCH_UPDATED",
                    module: "CLIENTS",
                    description: `Updated branch ${id}`,
                },
            })

            return updated
        })

        return NextResponse.json(branch, { status: 200 })
    } catch (error: unknown) {
        console.error("Error updating branch:", error)
        return internalServerError("Failed to update branch")
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        const managerScope = deriveManagerScope(session)
        const actorId = session.user?.id || null

        const { id } = await params

        // Check if branch has active deployments
        const branch = await prisma.branch.findUnique({
            where: { id },
            include: {
                client: {
                    select: { regionId: true },
                },
                deployments: {
                    where: { status: "ACTIVE" },
                },
            },
        })

        if (!branch) {
            return notFound("Branch not found")
        }
        if (managerScope && managerScopeDenied(managerScope, { regionId: branch.client?.regionId || null })) {
            return forbidden("Forbidden: branch is outside your scope.")
        }

        if (branch.deployments.length > 0) {
            return badRequest("Cannot delete branch with active deployments")
        }

        await prisma.$transaction(async (tx) => {
            await tx.branch.delete({
                where: { id },
            })
            await tx.auditLog.create({
                data: {
                    userId: actorId,
                    event: "BRANCH_DELETED",
                    module: "CLIENTS",
                    description: `Deleted branch ${id}`,
                },
            })
        })

        return ok({ message: "Branch deleted successfully" })
    } catch (error: unknown) {
        console.error("Error deleting branch:", error)
        return internalServerError("Failed to delete branch")
    }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import type { Session } from "next-auth"

async function checkClientScope(clientId: string, session: Session) {
    const managerScope = deriveManagerScope(session)
    if (!managerScope) return null
    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { regionId: true, regionalOfficeId: true },
    })
    if (!client) return "not_found"
    if (managerScopeDenied(managerScope, { regionId: client.regionId, regionalOfficeId: client.regionalOfficeId })) return "forbidden"
    return null
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        const { id: clientId } = await params

        const scope = await checkClientScope(clientId, session)
        if (scope === "not_found") return notFound("Client not found.")
        if (scope === "forbidden") return forbidden("Access denied.")

        const contracts = await prisma.clientContract.findMany({
            where: { clientId },
            include: {
                branch: { select: { id: true, name: true } },
                rates: { orderBy: [{ province: "asc" }, { city: "asc" }, { guardType: "asc" }] },
            },
            orderBy: { createdAt: "desc" },
        })
        return NextResponse.json(contracts)
    } catch (error) {
        console.error("Error fetching contracts:", error)
        return internalServerError("Failed to fetch contracts")
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        const { id: clientId } = await params
        const body = await request.json()

        const scope = await checkClientScope(clientId, session)
        if (scope === "not_found") return notFound("Client not found.")
        if (scope === "forbidden") return forbidden("Access denied.")

        const actorId = session.user?.id || null
        const actorName = session.user?.name || session.user?.email || actorId || "Unknown"

        const name = String(body?.name || "").trim()
        if (!name) return badRequest("Contract name is required.")

        const contract = await prisma.$transaction(async (tx) => {
            const created = await tx.clientContract.create({
                data: {
                    clientId,
                    branchId: body?.branchId ? String(body.branchId) : null,
                    name,
                    type: body?.type ? String(body.type).toUpperCase() : "GENERAL",
                    startDate: body?.startDate ? new Date(body.startDate) : null,
                    endDate: body?.endDate ? new Date(body.endDate) : null,
                    isActive: true,
                },
                include: {
                    branch: { select: { id: true, name: true } },
                    rates: true,
                },
            })
            await tx.auditLog.create({
                data: {
                    userId: actorId,
                    event: "CONTRACT_CREATED",
                    module: "CLIENTS",
                    description: `Contract "${name}" created for client ${clientId}${body?.branchId ? ` (branch ${body.branchId})` : ""}. By: ${actorName}`,
                },
            })
            return created
        })
        return NextResponse.json(contract, { status: 201 })
    } catch (error) {
        console.error("Error creating contract:", error)
        return internalServerError("Failed to create contract")
    }
}

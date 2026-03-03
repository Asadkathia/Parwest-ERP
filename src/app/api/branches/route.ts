import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import type { Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        const managerScope = deriveManagerScope(session)

        const { searchParams } = new URL(request.url)
        const clientId = searchParams.get("clientId") || undefined
        const search = searchParams.get("search")?.trim()

        const where: Prisma.BranchWhereInput = {}
        if (clientId) where.clientId = clientId
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
            ]
        }

        const clientScope = buildManagerScopeWhere(managerScope, { regionId: "regionId" })
        if (Object.keys(clientScope).length > 0) {
            where.client = { is: clientScope }
        }

        const branches = await prisma.branch.findMany({
            where,
            orderBy: { name: "asc" },
            include: {
                client: {
                    select: {
                        id: true,
                        name: true,
                        regionId: true,
                    },
                },
            },
            take: 500,
        })

        return NextResponse.json(branches)
    } catch (error: unknown) {
        console.error("Error fetching branches:", error)
        return internalServerError("Failed to fetch branches")
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        const managerScope = deriveManagerScope(session)
        const actorId = session.user?.id || null

        const body = await request.json()
        const name = String(body?.name || "").trim()
        if (!name) {
            return badRequest("name is required.")
        }
        const clientId = body?.clientId ? String(body.clientId) : ""
        if (!clientId) {
            return badRequest("clientId is required.")
        }
        if (managerScope && body?.clientId) {
            const client = await prisma.client.findUnique({
                where: { id: clientId },
                select: { id: true, regionId: true },
            })
            if (!client) {
                return notFound("Client not found")
            }
            if (managerScopeDenied(managerScope, { regionId: client.regionId })) {
                return forbidden("Forbidden: cannot create branch outside your scope.")
            }
        }

        const branch = await prisma.$transaction(async (tx) => {
            const created = await tx.branch.create({
                data: {
                    clientId,
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
                    event: "BRANCH_CREATED",
                    module: "CLIENTS",
                    description: `Created branch ${created.id} for client ${clientId}`,
                },
            })

            return created
        })

        return NextResponse.json(branch, { status: 201 })
    } catch (error: unknown) {
        console.error("Error creating branch:", error)
        return internalServerError("Failed to create branch")
    }
}

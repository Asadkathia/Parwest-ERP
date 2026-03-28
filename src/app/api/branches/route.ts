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

        const toInt = (v: unknown) => { const n = parseInt(String(v ?? ""), 10); return isNaN(n) ? null : n }
        const toFloat = (v: unknown) => { const n = parseFloat(String(v ?? "")); return isNaN(n) ? null : n }

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
                    contactPersonDesignation: body?.contactPersonDesignation ? String(body.contactPersonDesignation) : null,
                    contactPhone: body?.contactPhone ? String(body.contactPhone) : null,
                    contactEmail: body?.contactEmail ? String(body.contactEmail) : null,
                    isHeadOffice: body?.isHeadOffice === true,
                    contractUrl: body?.contractUrl ? String(body.contractUrl) : null,
                    contractAttachments: Array.isArray(body?.contractAttachments) && body.contractAttachments.length > 0 ? body.contractAttachments : undefined,
                    assignedManagerId: body?.assignedManagerId ? String(body.assignedManagerId) : null,
                    regionalOfficeId: body?.regionalOfficeId ? String(body.regionalOfficeId) : null,
                    // Contract details
                    contractStart:    body?.contractStart    ? new Date(body.contractStart)    : null,
                    contractEnd:      body?.contractEnd      ? new Date(body.contractEnd)      : null,
                    contractRateStart: body?.contractRateStart ? new Date(body.contractRateStart) : null,
                    contractRateEnd:   body?.contractRateEnd   ? new Date(body.contractRateEnd)   : null,
                    contractDayGuardDesignation:   body?.contractDayGuardDesignation   ? String(body.contractDayGuardDesignation)   : null,
                    contractDayGuardExService:     body?.contractDayGuardExService     ? String(body.contractDayGuardExService)     : null,
                    contractNightGuardDesignation: body?.contractNightGuardDesignation ? String(body.contractNightGuardDesignation) : null,
                    contractNightGuardExService:   body?.contractNightGuardExService   ? String(body.contractNightGuardExService)   : null,
                    contractAdditionalDayGuards:   toInt(body?.contractAdditionalDayGuards),
                    contractAdditionalNightGuards: toInt(body?.contractAdditionalNightGuards),
                    contractPrice:    toFloat(body?.contractPrice),
                },
                include: {
                    client: true,
                },
            })

            // Create supervisor assignment if provided
            const supervisorId = body?.assignedSupervisorId ? String(body.assignedSupervisorId).trim() : ""
            if (supervisorId) {
                await tx.clientSupervisorAssignment.create({
                    data: { clientId, branchId: created.id, supervisorId },
                }).catch(() => { /* ignore if user not found */ })
            }

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

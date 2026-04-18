import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        const managerScope = deriveManagerScope(session)

        const { id } = await params
        if (managerScope) {
            const client = await prisma.client.findUnique({
                where: { id },
                select: { regionId: true },
            })
            if (!client) {
                return notFound("Client not found")
            }
            if (managerScopeDenied(managerScope, { regionId: client.regionId })) {
                return forbidden("Forbidden: client is outside your scope.")
            }
        }

        const branches = await prisma.branch.findMany({
            where: { clientId: id },
            orderBy: { name: "asc" },
            include: {
                supervisorAssignments: {
                    where: { status: "ACTIVE" },
                    include: { supervisor: { select: { id: true, name: true } } },
                    orderBy: { effectiveDate: "desc" },
                    take: 1,
                },
                _count: { select: { deployments: true } },
            },
        })

        const mapped = branches.map((b) => ({
            id: b.id,
            name: b.name,
            code: b.code,
            city: b.city,
            address: b.address,
            contactPerson: b.contactPerson,
            supervisorId: b.supervisorAssignments[0]?.supervisor?.id ?? null,
            supervisorName: b.supervisorAssignments[0]?.supervisor?.name ?? null,
            activeDeployments: b._count.deployments,
        }))

        return NextResponse.json(mapped)
    } catch (error: unknown) {
        console.error("Error fetching branches:", error)
        return internalServerError("Failed to fetch branches")
    }
}

export async function POST(
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

        const client = await prisma.client.findUnique({
            where: { id },
            select: { id: true, regionId: true },
        })
        if (!client) {
            return notFound("Client not found")
        }
        if (managerScope && managerScopeDenied(managerScope, { regionId: client.regionId })) {
            return forbidden("Forbidden: client is outside your scope.")
        }

        const branch = await prisma.$transaction(async (tx) => {
            const created = await tx.branch.create({
                data: {
                    clientId: id,
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

            return created
        })

        await safeAuditLog({
            userId: actorId,
            event: "BRANCH_CREATED",
            module: "CLIENTS",
            description: `Created branch ${branch.id} for client ${id}`,
        })

        return NextResponse.json(branch, { status: 201 })
    } catch (error: unknown) {
        console.error("Error creating client branch:", error)
        return internalServerError("Failed to create branch")
    }
}

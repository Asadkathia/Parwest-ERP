import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { clientInScope } from "@/lib/clients/access"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { cityForBranch } from "@/lib/geo/regionCity"
import { provinceForBranch } from "@/lib/geo/province"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasAction(session, "CLIENTS", "VIEW")) return forbidden("Access denied.")
        const managerScope = deriveManagerScope(session)

        const { id } = await params
        if (managerScope) {
            const client = await prisma.client.findUnique({
                where: { id },
                select: { id: true },
            })
            if (!client) {
                return notFound("Client not found")
            }
            // Branch-based scoping (B1): a client is in scope when it has a branch
            // in the manager's region/office (or is a branchless client in it).
            if (!(await clientInScope(id, managerScope))) {
                return forbidden("Forbidden: client is outside your scope.")
            }
        }

        // Optional region-office scoping: the deploy flow selects a regional office first,
        // so it passes ?regionalOfficeId= to show only this client's branches in that office
        // (Branch.regionalOfficeId is the office link; region/province derive from it). Other
        // callers omit the param and get all of the client's branches. (Ticket #59)
        const regionalOfficeId = request.nextUrl.searchParams.get("regionalOfficeId")?.trim() || null

        const branches = await prisma.branch.findMany({
            where: { clientId: id, ...(regionalOfficeId ? { regionalOfficeId } : {}) },
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
        if (!hasAction(session, "CLIENTS", "CREATE")) return forbidden("Access denied.")
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
            select: { id: true },
        })
        if (!client) {
            return notFound("Client not found")
        }
        // Branch-based scoping (B1): the branch's office IS the scope key, so a
        // restricted manager must supply an in-scope office (a null office would
        // both fail the guard open AND leave the branch unscopeable). Deny when
        // absent or out of scope.
        const branchOfficeId = body?.regionalOfficeId ? String(body.regionalOfficeId) : null
        if (managerScope && (!branchOfficeId || managerScopeDenied(managerScope, { regionalOfficeId: branchOfficeId }))) {
            return forbidden("Forbidden: a branch must be created in an office within your scope.")
        }

        // City + province are DERIVED from the branch's region (office → region) —
        // never trust client-sent values, to avoid region/city/province drift.
        const branchGeo = {
            regionalOfficeId: branchOfficeId,
            regionId: body?.regionId ? String(body.regionId) : null,
            clientId: id,
        }
        const city = await cityForBranch(prisma, branchGeo)
        const province = await provinceForBranch(prisma, branchGeo)

        const branch = await prisma.$transaction(async (tx) => {
            const created = await tx.branch.create({
                data: {
                    clientId: id,
                    name,
                    code: body?.code ? String(body.code).trim() : null,
                    address: body?.address ? String(body.address) : null,
                    city,
                    province,
                    regionalOfficeId: branchOfficeId,
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

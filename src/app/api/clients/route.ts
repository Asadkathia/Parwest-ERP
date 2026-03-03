import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isMockEnabled } from "@/lib/mockData"
import { mockClientsList } from "@/lib/mockData/clients"
import { applyManagerScope, buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import type { Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        const managerScope = deriveManagerScope(session)

        const { searchParams } = new URL(request.url)
        const regionId = searchParams.get("regionId")
        const status = searchParams.get("status")

        const where: Prisma.ClientWhereInput = {}
        if (regionId) where.regionId = regionId
        if (status) where.status = status
        Object.assign(where, buildManagerScopeWhere(managerScope, { regionId: "regionId" }))

        if (isMockEnabled()) {
            const clients = mockClientsList
                .filter((client) => (where.status ? client.status === where.status : true))
                .filter((client) =>
                    applyManagerScope([client], managerScope, {
                        regionId: (row) => (row as Record<string, unknown>).regionId as string | null | undefined,
                    }).length > 0
                )
                .map((client) => ({
                    id: client.id,
                    name: client.name,
                    type: client.type,
                    city: client.city,
                    status: client.status,
                    regionId: client.regionId,
                    region: client.regionId ? { id: client.regionId, name: client.regionId } : null,
                }))
            return NextResponse.json(clients)
        }

        const clients = await prisma.client.findMany({
            where,
            orderBy: { name: "asc" },
            include: {
                region: true,
            },
        })

        return NextResponse.json(clients)
    } catch (error: unknown) {
        console.error("Error fetching clients:", error)
        return internalServerError("Failed to fetch clients")
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        const managerScope = deriveManagerScope(session)

        const body = await request.json()
        const bodyRegionId = body?.regionId ? String(body.regionId) : null
        if (managerScope && managerScopeDenied(managerScope, { regionId: bodyRegionId })) {
            return forbidden("Forbidden: cannot create client outside your scope.")
        }

        if (isMockEnabled()) {
            const mock = {
                id: `mock-client-${Date.now()}`,
                name: String(body.name || "Mock Client"),
                email: body.email || null,
                type: body.type || "OTHER",
                isBranchless: body.isBranchless === "true",
                headOfficeAddress: body.headOfficeAddress || null,
                city: body.city || null,
                status: body.status || "ACTIVE",
                logoUrl: body.logoUrl || null,
                ntn: body.ntn || null,
                strn: body.strn || null,
                contractUrl: body.contractUrl || null,
                regionId: body.regionId || null,
            }
            return NextResponse.json(mock, { status: 201 })
        }

        const client = await prisma.client.create({
            data: {
                name: body.name,
                email: body.email || null,
                type: body.type,
                isBranchless: body.isBranchless === "true",
                headOfficeAddress: body.headOfficeAddress || null,
                city: body.city || null,
                status: body.status || "ACTIVE",
                logoUrl: body.logoUrl || null,
                ntn: body.ntn || null,
                strn: body.strn || null,
                contractUrl: body.contractUrl || null,
                regionId: body.regionId || null,
            },
        })

        return NextResponse.json(client, { status: 201 })
    } catch (error: unknown) {
        console.error("Error creating client:", error)
        return internalServerError("Failed to create client")
    }
}

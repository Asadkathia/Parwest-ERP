import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
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

        if (isRuntimeMockEnabled()) {
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

        if (isRuntimeMockEnabled()) {
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

        const isBranchless = body.isBranchless === "true"
        const defaultBranchName = body.defaultBranchName ? String(body.defaultBranchName).trim() : ""

        // Resolve city — form sends it as `clientLocation`
        const city = body.clientLocation || body.city || null

        // Resolve regionId — form sends it as `locationRegionalOffice`
        const regionId = body.locationRegionalOffice || body.regionId || null

        // Resolve GPS — prefer manual override over map picker
        const latitude  = parseFloat(body.latitudeManual  || body.latitude  || "") || null
        const longitude = parseFloat(body.longitudeManual || body.longitude || "") || null

        // Parse numeric capacities
        const toInt = (v: unknown) => { const n = parseInt(String(v ?? ""), 10); return isNaN(n) ? null : n }
        const toFloat = (v: unknown) => { const n = parseFloat(String(v ?? "")); return isNaN(n) ? null : n }

        const client = await prisma.client.create({
            data: {
                // Core
                name:             body.name,
                email:            body.email            || null,
                type:             body.type,
                isBranchless,
                headOfficeAddress: body.headOfficeAddress || null,
                city,
                status:           body.status           || "ACTIVE",
                logoUrl:          body.logoUrl           || null,
                ntn:              body.ntn               || null,
                strn:             body.strn              || null,
                contractUrl:      body.contractUrl       || null,
                contractAttachments: Array.isArray(body.contractAttachments) && body.contractAttachments.length > 0
                    ? body.contractAttachments : undefined,
                regionId,
                enrollmentDate:   body.enrollmentDate ? new Date(body.enrollmentDate) : new Date(),

                // Contact
                contactPerson:   body.contactPerson  || null,
                phone:           body.contactNumber  || null,
                contactNumbers:  Array.isArray(body.contactNumbers) && body.contactNumbers.length > 0
                    ? body.contactNumbers : undefined,
                postalCode:      body.clientPostalCode || null,

                // Introducer
                introducerName:          body.introducerName          || null,
                introducerContactNumber: body.introducerContactNumber || null,
                introducerAddress:       body.introducerAddress       || null,
                introducerCnic:          body.introducerCnicNumber    || null,

                // Operational
                operationalProvinces: body.operationalProvinces || null,

                // Assigned users
                assignedManagerId: body.assignedManagerId || null,

                // GPS
                latitude,
                longitude,

                // Capacities
                dayGuardCapacity:        toInt(body.dayGuardCapacity),
                nightGuardCapacity:      toInt(body.nightGuardCapacity),
                daySupervisorCapacity:   toInt(body.daySupervisorCapacity),
                nightSupervisorCapacity: toInt(body.nightSupervisorCapacity),
                cpoCapacity:             toInt(body.cpoCapacity),

                // Contract details
                contractStart:            body.contractStart      ? new Date(body.contractStart)      : null,
                contractEnd:              body.contractEnd        ? new Date(body.contractEnd)        : null,
                contractRateStart:        body.contractRateStart  ? new Date(body.contractRateStart)  : null,
                contractRateEnd:          body.contractRateEnd    ? new Date(body.contractRateEnd)    : null,
                contractGuardDesignation: body.contractGuardDesignation  || null,
                contractAdditionalGuards: toInt(body.contractAdditionalGuards),
                contractGuardExService:   body.contractGuardExService    || null,
                contractPrice:            toFloat(body.contractPrice),

                // Auto-create the first branch if a name was provided (branch clients only)
                ...(!isBranchless && defaultBranchName ? {
                    branches: {
                        create: {
                            name:          defaultBranchName,
                            type:          body.branchType        || null,
                            isHeadOffice:  true,
                            address:       body.headOfficeAddress || null,
                            city,
                            contactPerson: body.contactPerson     || null,
                            contactPhone:  body.contactNumber     || null,
                        },
                    },
                } : {}),
            },
            include: { branches: true },
        })

        // Create supervisor assignment if provided
        const supervisorId = body.assignedSupervisorId ? String(body.assignedSupervisorId).trim() : ""
        if (supervisorId) {
            await prisma.clientSupervisorAssignment.create({
                data: { clientId: client.id, supervisorId },
            }).catch(() => { /* ignore if user not found */ })
        }

        return NextResponse.json(client, { status: 201 })
    } catch (error: unknown) {
        console.error("Error creating client:", error)
        return internalServerError("Failed to create client")
    }
}

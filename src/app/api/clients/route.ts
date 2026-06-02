import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { mockClientsList } from "@/lib/mockData/clients"
import { applyManagerScope, buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import type { Prisma } from "@prisma/client"
import { cityForBranch, cityForRegionId } from "@/lib/geo/regionCity"
import { checkRegionWithinProvince } from "@/lib/geo/province"
import { assignSupervisor } from "@/lib/clients/supervisorAssignment"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasAction(session, "CLIENTS", "VIEW")) return forbidden("Access denied.")
        const managerScope = deriveManagerScope(session)

        const { searchParams } = new URL(request.url)
        const regionId = searchParams.get("regionId")
        const regionalOfficeId = searchParams.get("regionalOfficeId")
        const status = searchParams.get("status")

        const where: Prisma.ClientWhereInput = {}
        if (regionId) where.regionId = regionId
        if (regionalOfficeId) where.regionalOfficeId = regionalOfficeId
        if (status) where.status = status
        Object.assign(where, buildManagerScopeWhere(managerScope, { regionId: "regionId", regionalOfficeId: "regionalOfficeId" }))

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

        // Explicit select: list consumers only need these fields. Excludes heavy
        // base64 blobs (logoUrl) and legacy contract* columns / contractAttachments
        // / contractUrl so the list payload stays small.
        const clients = await prisma.client.findMany({
            where,
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
                type: true,
                email: true,
                city: true,
                status: true,
                isBranchless: true,
                regionId: true,
                regionalOfficeId: true,
                contactPerson: true,
                phone: true,
                enrollmentDate: true,
                createdAt: true,
                region: { select: { id: true, name: true } },
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
        if (!hasAction(session, "CLIENTS", "CREATE")) return forbidden("Access denied.")
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
                isBranchless: body.isBranchless === true || body.isBranchless === "true",
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

        // The client form sends this as a JS boolean after merging state into
        // the POST body; older callers may still send the string "true". Accept
        // both so branchless clients aren't silently stored with isBranchless=false.
        const isBranchless = body.isBranchless === true || body.isBranchless === "true"
        // For branchless clients the form sends "__branchless_default__" as a sentinel;
        // we store it as "Default Branch" so the record is identifiable but treated as branchless.
        const rawBranchName = body.defaultBranchName ? String(body.defaultBranchName).trim() : ""
        const defaultBranchName = rawBranchName === "__branchless_default__"
            ? "Default Branch"
            : rawBranchName

        // Resolve regionId and regionalOfficeId
        const regionId = body.regionId || body.locationRegionalOffice || null
        const regionalOfficeId = body.regionalOfficeId || null

        // Province ↔ region consistency: the home Region must lie within the
        // selected operational province (e.g. KPK cannot host the Lahore region). (#47)
        const operationalProvince = body.operationalProvinces ? String(body.operationalProvinces).trim() : ""
        const provinceCheck = await checkRegionWithinProvince(prisma, { regionId, operationalProvince })
        if (!provinceCheck.ok) return badRequest(provinceCheck.message)

        // Derive city from the region — Region.name IS the operating city.
        // Ignore any client-sent city/clientLocation to prevent region/city drift.
        const city = await cityForRegionId(prisma, regionId)

        // Resolve GPS — prefer manual override over map picker
        const latitude  = parseFloat(body.latitudeManual  || body.latitude  || "") || null
        const longitude = parseFloat(body.longitudeManual || body.longitude || "") || null

        // Parse numeric capacities
        const toInt = (v: unknown) => { const n = parseInt(String(v ?? ""), 10); return isNaN(n) ? null : n }

        // Derive the default branch's city from its own region (may differ from the client's region).
        const branchCity = await cityForBranch(prisma, {
            regionalOfficeId: body.branchRegionalOfficeId || regionalOfficeId || null,
            regionId: body.branchRegionId || regionId || null,
            clientId: null,
        })

        // Supervisor assignments are created atomically with the client below.
        const supervisorId = body.assignedSupervisorId ? String(body.assignedSupervisorId).trim() : ""
        const branchSupervisorId = body.branchAssignedSupervisorId ? String(body.branchAssignedSupervisorId).trim() : ""

        // Create the client (+ nested default/full branch) and any supervisor
        // assignments in a single transaction so a bad supervisorId rolls the
        // whole thing back instead of leaving an orphaned client.
        const client = await prisma.$transaction(async (tx) => {
          const created = await tx.client.create({
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
                regionalOfficeId,
                enrollmentDate:   body.enrollmentDate ? new Date(body.enrollmentDate) : new Date(),

                // Contact
                contactPerson:            body.contactPerson             || null,
                contactPersonDesignation: body.contactPersonDesignation  || null,
                phone:                    body.contactNumber             || null,
                contactNumbers:  Array.isArray(body.contactNumbers) && body.contactNumbers.length > 0
                    ? body.contactNumbers : undefined,
                postalCode:      body.clientPostalCode || null,

                // Introducer
                introducerName:          body.introducerName          || null,
                introducerContactNumber: body.introducerContactNumber || null,
                introducerAddress:       body.introducerAddress       || null,
                introducerCnic:          body.introducerCnicNumber    || null,

                // Operational
                operationalProvinces: operationalProvince || null,

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

                // NOTE: Flat contract* columns are intentionally NOT written here.
                // Contracts are canonical via the ClientContract model; these legacy
                // columns are read by nothing. contractUrl/contractAttachments are
                // still written above.

                // Auto-create a branch: full branch for branch clients, default branch for branchless clients
                ...(defaultBranchName ? {
                    branches: {
                        create: {
                            name:          defaultBranchName,
                            type:          body.branchType        || null,
                            isHeadOffice:  true,
                            address:       body.headOfficeAddress || null,
                            city:          branchCity,
                            contactPerson: body.branchContactPerson || body.contactPerson || null,
                            contactPhone:  body.branchContactPhone  || body.contactNumber  || null,
                            // branch-specific fields from the expanded branch section
                            code:                     body.branchCode                    || null,
                            province:                 body.branchProvince                || null,
                            contactPersonDesignation: body.branchContactPersonDesignation || null,
                            contactPersonCnic:        body.branchContactPersonCnic        || null,
                            contactPersonPhone:       body.branchContactPersonPhone       || null,
                            contactEmail:             body.branchContactEmail             || null,
                            latitude:  body.branchLatitude  ? parseFloat(body.branchLatitude)  : null,
                            longitude: body.branchLongitude ? parseFloat(body.branchLongitude) : null,
                            enrollmentDate:    body.branchEnrollmentDate ? new Date(body.branchEnrollmentDate) : null,
                            isLockerBranch:    body.branchIsLockerBranch === "yes",
                            dayGuardCapacity:         body.branchDayGuardCapacity        ? parseInt(body.branchDayGuardCapacity)        : null,
                            nightGuardCapacity:       body.branchNightGuardCapacity       ? parseInt(body.branchNightGuardCapacity)       : null,
                            daySupervisorCapacity:    body.branchDaySupervisorCapacity    ? parseInt(body.branchDaySupervisorCapacity)    : null,
                            nightSupervisorCapacity:  body.branchNightSupervisorCapacity  ? parseInt(body.branchNightSupervisorCapacity)  : null,
                            dayCpoCapacity:           body.branchDayCpoCapacity           ? parseInt(body.branchDayCpoCapacity)           : null,
                            nightCpoCapacity:         body.branchNightCpoCapacity         ? parseInt(body.branchNightCpoCapacity)         : null,
                            daySoCapacity:            body.branchDaySoCapacity            ? parseInt(body.branchDaySoCapacity)            : null,
                            nightSoCapacity:          body.branchNightSoCapacity          ? parseInt(body.branchNightSoCapacity)          : null,
                            dayAsoCapacity:           body.branchDayAsoCapacity           ? parseInt(body.branchDayAsoCapacity)           : null,
                            nightAsoCapacity:         body.branchNightAsoCapacity         ? parseInt(body.branchNightAsoCapacity)         : null,
                            dayLsoCapacity:           body.branchDayLsoCapacity           ? parseInt(body.branchDayLsoCapacity)           : null,
                            nightLsoCapacity:         body.branchNightLsoCapacity         ? parseInt(body.branchNightLsoCapacity)         : null,
                            dayCctvCapacity:          body.branchDayCctvCapacity          ? parseInt(body.branchDayCctvCapacity)          : null,
                            nightCctvCapacity:        body.branchNightCctvCapacity        ? parseInt(body.branchNightCctvCapacity)        : null,
                            dayReceptionistCapacity:  body.branchDayReceptionistCapacity  ? parseInt(body.branchDayReceptionistCapacity)  : null,
                            nightReceptionistCapacity: body.branchNightReceptionistCapacity ? parseInt(body.branchNightReceptionistCapacity) : null,
                            branchManagerName:        body.branchManagerName    || null,
                            branchManagerContact:     body.branchManagerContact || null,
                            branchManagerEmail:       body.branchManagerEmail   || null,
                            operationsManagerId:      body.branchOperationsManagerId      || null,
                            operationsManagerContact: body.branchOperationsManagerContact  || null,
                            supervisorContact:        body.branchSupervisorContact        || null,
                            regionalOfficeId:         body.branchRegionalOfficeId || regionalOfficeId || null,
                            assignedManagerId:        body.branchAssignedManagerId        || null,
                        },
                    },
                } : {}),
            },
            include: { branches: true },
          })

          // Client-level supervisor assignment (validates user, dedups prior ACTIVE).
          if (supervisorId) {
            await assignSupervisor(tx, { clientId: created.id, supervisorId })
          }

          // Branch-level supervisor assignment for the auto-created branch.
          const createdBranchId = created.branches?.[0]?.id
          if (branchSupervisorId && createdBranchId) {
            await assignSupervisor(tx, { clientId: created.id, branchId: createdBranchId, supervisorId: branchSupervisorId })
          }

          return created
        })

        return NextResponse.json(client, { status: 201 })
    } catch (error: unknown) {
        // A bad supervisorId surfaces from assignSupervisor as a "not found" error.
        if (error instanceof Error && error.message.startsWith("Supervisor user not found")) {
            return badRequest("Assigned supervisor not found.")
        }
        console.error("Error creating client:", error)
        return internalServerError("Failed to create client")
    }
}

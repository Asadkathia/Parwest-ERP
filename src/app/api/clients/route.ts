import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { mockClientsList } from "@/lib/mockData/clients"
import { applyManagerScope, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { clientScopeWhere } from "@/lib/clients/access"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import type { Prisma } from "@prisma/client"
import { cityForBranch, cityForRegionId } from "@/lib/geo/regionCity"
import { provinceForBranch } from "@/lib/geo/province"
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

        // Each filter is its own branch-OR-branchless block; they AND together so a
        // region param and the manager scope both apply without clobbering each other.
        const filters: Prisma.ClientWhereInput[] = []
        if (status) filters.push({ status })
        // Topbar region/office URL params narrow with the SAME branch-OR-branchless
        // shape used for scoping: a client matches a region if it has a branch in
        // that region, OR it is branchless and its own region matches. (B1)
        if (regionId) {
            filters.push({
                OR: [
                    { branches: { some: { regionalOffice: { regionId } } } },
                    { isBranchless: true, regionId },
                ],
            })
        }
        if (regionalOfficeId) {
            filters.push({
                OR: [
                    { branches: { some: { regionalOfficeId } } },
                    { isBranchless: true, regionalOfficeId },
                ],
            })
        }
        // Regional-manager scoping (branch-OR-branchless); `{}` when unrestricted.
        const scopeWhere = clientScopeWhere(managerScope)
        if (Object.keys(scopeWhere).length > 0) filters.push(scopeWhere)
        const where: Prisma.ClientWhereInput = filters.length > 0 ? { AND: filters } : {}

        if (isRuntimeMockEnabled()) {
            const clients = mockClientsList
                .filter((client) => (status ? client.status === status : true))
                .filter((client) =>
                    applyManagerScope([client], managerScope, {
                        regionId: (row) => (row as Record<string, unknown>).regionId as string | null | undefined,
                    }).length > 0
                )
                .map((client) => ({
                    id: client.id,
                    name: client.name,
                    type: client.type,
                    status: client.status,
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
                status: true,
                isBranchless: true,
                regionalOfficeId: true,
                contactPerson: true,
                phone: true,
                enrollmentDate: true,
                createdAt: true,
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
        // Branchful clients are region-less (geo lives on branches), so they scope by
        // the default branch's office; branchless clients keep their own region. (B1)
        const isBranchlessClient = body.isBranchless === true || body.isBranchless === "true"
        if (managerScope) {
            // A restricted (regional) creator MUST anchor the new client inside their
            // scope: a branchful client needs an in-scope default-branch office, a
            // branchless client an in-scope region. A missing value is NOT a free pass
            // (managerScopeDenied fails open on null) — it would create an unscopeable
            // record invisible even to the creator. Deny when the anchor is absent. (B1)
            const branchOffice = body.branchRegionalOfficeId || body.regionalOfficeId || null
            const denied = isBranchlessClient
                ? (!body.regionId || managerScopeDenied(managerScope, { regionId: String(body.regionId) }))
                : (!branchOffice || managerScopeDenied(managerScope, { regionalOfficeId: String(branchOffice) }))
            if (denied) {
                return forbidden("Forbidden: cannot create client outside your scope.")
            }
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

        // The client form sends isBranchless as a JS boolean after merging state into
        // the POST body; older callers may still send the string "true". Resolved above
        // as `isBranchlessClient` — alias for the data writes below.
        const isBranchless = isBranchlessClient
        // For branchless clients the form sends "__branchless_default__" as a sentinel;
        // we store it as "Default Branch" so the record is identifiable but treated as branchless.
        const rawBranchName = body.defaultBranchName ? String(body.defaultBranchName).trim() : ""
        const defaultBranchName = rawBranchName === "__branchless_default__"
            ? "Default Branch"
            : rawBranchName

        // Branchful clients are region-less (B1): geo lives on their branches, so the
        // client's own region/office/province/city are stored NULL. Branchless clients
        // keep their region/office/operationalProvinces/city since they have no branch.
        const regionId = isBranchless ? (body.regionId || body.locationRegionalOffice || null) : null
        const regionalOfficeId = isBranchless ? (body.regionalOfficeId || null) : null
        const operationalProvince = isBranchless
            ? (body.operationalProvinces ? String(body.operationalProvinces).trim() : "")
            : ""
        // Derive city from the region — Region.name IS the operating city. Ignore any
        // client-sent city to prevent region/city drift. NULL for branchful clients.
        const city = isBranchless ? await cityForRegionId(prisma, regionId) : null

        // Resolve GPS — prefer manual override over map picker
        const latitude  = parseFloat(body.latitudeManual  || body.latitude  || "") || null
        const longitude = parseFloat(body.longitudeManual || body.longitude || "") || null

        // Parse numeric capacities
        const toInt = (v: unknown) => { const n = parseInt(String(v ?? ""), 10); return isNaN(n) ? null : n }

        // Derive the default branch's city AND province from its own region (mirrors
        // api/branches/route.ts). Province is NEVER trusted from the client-sent value
        // so a branch can't sit in a province its region doesn't belong to. (#47/#64)
        const branchGeo = {
            regionalOfficeId: body.branchRegionalOfficeId || regionalOfficeId || null,
            regionId: body.branchRegionId || regionId || null,
            clientId: null,
        }
        const branchCity = await cityForBranch(prisma, branchGeo)
        const branchProvince = await provinceForBranch(prisma, branchGeo)

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
                            province:                 branchProvince,
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

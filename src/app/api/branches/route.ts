import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import type { Prisma } from "@prisma/client"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { cityForBranch } from "@/lib/geo/regionCity"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasAction(session, "CLIENTS", "VIEW")) return forbidden()
        const managerScope = deriveManagerScope(session)

        const { searchParams } = new URL(request.url)
        const clientId = searchParams.get("clientId") || undefined
        const search = searchParams.get("search")?.trim()
        const regionId = searchParams.get("regionId")
        const regionalOfficeId = searchParams.get("regionalOfficeId")

        if (managerScopeDenied(managerScope, { regionId, regionalOfficeId })) {
            return forbidden("Forbidden: requested scope is outside your assigned region.")
        }

        const where: Prisma.BranchWhereInput = {}
        if (clientId) where.clientId = clientId
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
            ]
        }

        const clientScope = buildManagerScopeWhere(managerScope, { regionId: "regionId" })
        const clientFilter = {
            ...(regionId ? { regionId } : {}),
            ...clientScope,
        }
        if (Object.keys(clientFilter).length > 0) {
            where.client = { is: clientFilter }
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
        if (!hasAction(session, "CLIENTS", "CREATE")) return forbidden()
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

        const toDate = (v: unknown) => { const d = v ? new Date(String(v)) : null; return d && !isNaN(d.getTime()) ? d : null }
        const toBool = (v: unknown) => v === true || v === "true" || v === "on"

        const branch = await prisma.$transaction(async (tx) => {
            // Derive city from the branch's region — Region.name IS the operating city.
            // Ignore any client-sent city to prevent region/city drift.
            const city = await cityForBranch(tx, {
                regionalOfficeId: body?.regionalOfficeId ? String(body.regionalOfficeId) : null,
                regionId: body?.regionId ? String(body.regionId) : null,
                clientId,
            })

            const created = await tx.branch.create({
                data: {
                    clientId,
                    name,
                    code: body?.code ? String(body.code).trim() : null,
                    address: body?.address ? String(body.address) : null,
                    city,
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
                    // Contract attachments only — flat contract pricing/designation
                    // columns are dead (write-only, read by nothing). Branch pricing
                    // is canonical via ClientContract with branchId.
                    // Location
                    latitude:  toFloat(body?.latitude  ?? body?.latitudeManual),
                    longitude: toFloat(body?.longitude ?? body?.longitudeManual),
                    // Capacity
                    dayGuardCapacity:         toInt(body?.dayGuardCapacity),
                    nightGuardCapacity:       toInt(body?.nightGuardCapacity),
                    daySupervisorCapacity:    toInt(body?.daySupervisorCapacity),
                    nightSupervisorCapacity:  toInt(body?.nightSupervisorCapacity),
                    cpoCapacity:              toInt(body?.cpoCapacity),
                    dayCpoCapacity:           toInt(body?.dayCpoCapacity),
                    nightCpoCapacity:         toInt(body?.nightCpoCapacity),
                    daySoCapacity:            toInt(body?.daySoCapacity),
                    nightSoCapacity:          toInt(body?.nightSoCapacity),
                    dayAsoCapacity:           toInt(body?.dayAsoCapacity),
                    nightAsoCapacity:         toInt(body?.nightAsoCapacity),
                    dayLsoCapacity:           toInt(body?.dayLsoCapacity),
                    nightLsoCapacity:         toInt(body?.nightLsoCapacity),
                    dayCctvCapacity:          toInt(body?.dayCctvCapacity),
                    nightCctvCapacity:        toInt(body?.nightCctvCapacity),
                    dayReceptionistCapacity:  toInt(body?.dayReceptionistCapacity),
                    nightReceptionistCapacity: toInt(body?.nightReceptionistCapacity),
                    // Branch metadata
                    enrollmentDate:     toDate(body?.enrollmentDate),
                    isLockerBranch:     toBool(body?.isLockerBranch),
                    // Extended contact
                    contactPersonCnic:  body?.contactPersonCnic  ? String(body.contactPersonCnic)  : null,
                    contactPersonPhone: body?.contactPersonPhone ? String(body.contactPersonPhone) : null,
                    // Branch manager
                    branchManagerName:    body?.branchManagerName    ? String(body.branchManagerName)    : null,
                    branchManagerContact: body?.branchManagerContact ? String(body.branchManagerContact) : null,
                    branchManagerEmail:   body?.branchManagerEmail   ? String(body.branchManagerEmail)   : null,
                    // Operations manager
                    operationsManagerId:      body?.operationsManagerId      ? String(body.operationsManagerId)      : null,
                    operationsManagerContact: body?.operationsManagerContact ? String(body.operationsManagerContact) : null,
                    // Supervisor contact
                    supervisorContact: body?.supervisorContact ? String(body.supervisorContact) : null,
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

            return created
        })

        await safeAuditLog({
            userId: actorId,
            event: "BRANCH_CREATED",
            module: "CLIENTS",
            description: `Created branch ${branch.id} for client ${clientId}`,
        })

        return NextResponse.json(branch, { status: 201 })
    } catch (error: unknown) {
        console.error("Error creating branch:", error)
        return internalServerError("Failed to create branch")
    }
}

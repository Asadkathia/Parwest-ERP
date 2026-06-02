import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope } from "@/lib/access/scope"
import { clientInScope } from "@/lib/clients/access"
import { badRequest, conflict, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction, isSuperAdmin } from "@/lib/api/permissions"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"
import { cityForRegionId } from "@/lib/geo/regionCity"
import { checkRegionWithinProvince } from "@/lib/geo/province"
import { assignSupervisor } from "@/lib/clients/supervisorAssignment"

/** Build a human-readable diff of changed fields for audit logs. */
function buildChangeSummary(
    before: Record<string, unknown>,
    after: Record<string, unknown>
): string {
    const changed: string[] = []
    for (const key of Object.keys(after)) {
        const oldVal = before[key] ?? null
        const newVal = after[key] ?? null
        const oldStr = oldVal instanceof Date ? oldVal.toISOString() : String(oldVal ?? "")
        const newStr = newVal instanceof Date ? newVal.toISOString() : String(newVal ?? "")
        if (oldStr !== newStr) {
            changed.push(`${key}: "${oldStr}" → "${newStr}"`)
        }
    }
    return changed.length > 0 ? changed.join("; ") : "No fields changed"
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasAction(session, "CLIENTS", "UPDATE")) return forbidden("Access denied.")
        // Editing the client RECORD itself (vs. its branches) is a GLOBAL-only action
        // now that clients are region-less — only a SuperAdmin may mutate it. (B1)
        if (!isSuperAdmin(session)) {
            return forbidden("Forbidden: editing the client record requires global access.")
        }
        const managerScope = deriveManagerScope(session)
        const actorId = session.user?.id || null
        const actorName = session.user?.name || session.user?.email || actorId || "Unknown"

        const { id } = await params
        const body = await request.json()

        const existingClient = await prisma.client.findUnique({ where: { id } })

        if (!existingClient) {
            return notFound("Client not found")
        }
        // Branch-aware scope guard (branchful → by branches, branchless → own region).
        if (managerScope && !(await clientInScope(id, managerScope))) {
            return forbidden("Forbidden: client is outside your scope.")
        }

        // Reserve % override — accept null/blank or a decimal between 0 and 1.
        let reservePctValue: number | null | undefined = undefined
        if (Object.prototype.hasOwnProperty.call(body, "reservePct")) {
            const raw = body.reservePct
            if (raw === null || raw === "" || raw === undefined) {
                reservePctValue = null
            } else {
                const num = typeof raw === "number" ? raw : parseFloat(String(raw))
                if (Number.isNaN(num) || num < 0 || num > 1) {
                    return badRequest("reservePct must be a decimal between 0 and 1.")
                }
                reservePctValue = num
            }
        }

        // Ticket 33 — block client deactivation while any branch is still ACTIVE.
        // Mirrored on the PUT path so save-from-edit-form is also gated.
        const incomingStatus = body.status ? String(body.status) : null
        if (
            incomingStatus === "INACTIVE" &&
            existingClient.status !== "INACTIVE" &&
            isWorkflowRuleEnabled("branches.requireInactiveBranchesBeforeClientInactive")
        ) {
            const activeBranch = await prisma.branch.findFirst({
                where: { clientId: id, status: "ACTIVE" },
                select: { id: true },
            })
            if (activeBranch) {
                return conflict(
                    "Cannot deactivate client while branches are still active. Deactivate or remove all branches first."
                )
            }
        }

        // Build a partial update: only include a column when its key is present in
        // `body`. This prevents a partial PUT from nulling fields the caller never
        // sent. (NOTE: flat contract* columns are intentionally never written —
        // contracts are canonical via the ClientContract model. contractUrl /
        // contractAttachments are handled elsewhere, not here.)
        const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key)
        const newData: Record<string, unknown> = {}

        if (has("name")) newData.name = body.name
        if (has("type")) newData.type = body.type
        if (has("email")) newData.email = body.email || null
        if (has("enrollmentDate")) {
            newData.enrollmentDate = body.enrollmentDate ? new Date(body.enrollmentDate) : existingClient.enrollmentDate
        }
        // Geo (region/office/city/operationalProvinces) lives on the client record
        // ONLY for branchless clients (B1). For branchful clients geo lives on the
        // branches, so these writes are skipped entirely — the columns stay region-less.
        if (existingClient.isBranchless) {
            // Region drives city — Region.name IS the operating city. Derive city only
            // when regionId is sent, and never trust a client-sent city (drift guard).
            if (has("regionId")) {
                const nextRegionId = body.regionId || null
                newData.regionId = nextRegionId
                newData.city = await cityForRegionId(prisma, nextRegionId)
            }
            if (has("regionalOfficeId")) newData.regionalOfficeId = body.regionalOfficeId || null
        }
        if (has("status")) newData.status = body.status || "ACTIVE"
        if (has("isBranchless")) newData.isBranchless = body.isBranchless === true || body.isBranchless === "true"
        if (has("headOfficeAddress")) newData.headOfficeAddress = body.headOfficeAddress || null
        if (has("ntn")) newData.ntn = body.ntn || null
        if (has("strn")) newData.strn = body.strn || null
        if (has("logoUrl")) newData.logoUrl = body.logoUrl || null
        // Contact
        if (has("contactPerson")) newData.contactPerson = body.contactPerson || null
        if (has("contactPersonDesignation")) newData.contactPersonDesignation = body.contactPersonDesignation || null
        if (has("contactNumber")) newData.phone = body.contactNumber || null
        if (has("contactNumbers")) {
            newData.contactNumbers = Array.isArray(body.contactNumbers) && body.contactNumbers.length > 0
                ? body.contactNumbers : undefined
        }
        if (has("clientPostalCode")) newData.postalCode = body.clientPostalCode || null
        // Introducer
        if (has("introducerName")) newData.introducerName = body.introducerName || null
        if (has("introducerContactNumber")) newData.introducerContactNumber = body.introducerContactNumber || null
        if (has("introducerAddress")) newData.introducerAddress = body.introducerAddress || null
        if (has("introducerCnicNumber")) newData.introducerCnic = body.introducerCnicNumber || null
        // Operational — branchless only (branchful clients are region-less, B1).
        if (existingClient.isBranchless) {
            if (has("operationalProvinces")) {
                newData.operationalProvinces = (body.operationalProvinces ? String(body.operationalProvinces).trim() : "") || null
            }

            // Province ↔ region consistency: when region or province is being edited,
            // enforce that the home Region stays within its operational province. (#47)
            if (has("regionId") || has("operationalProvinces")) {
                const effectiveRegionId = has("regionId") ? (body.regionId || null) : existingClient.regionId
                const effectiveProvince = has("operationalProvinces")
                    ? (body.operationalProvinces ? String(body.operationalProvinces).trim() : "")
                    : (existingClient.operationalProvinces ?? "")
                const provinceCheck = await checkRegionWithinProvince(prisma, {
                    regionId: effectiveRegionId,
                    operationalProvince: effectiveProvince,
                })
                if (!provinceCheck.ok) return badRequest(provinceCheck.message)
            }
        }
        // Assigned
        if (has("assignedManagerId")) newData.assignedManagerId = body.assignedManagerId || null
        // Reserve %
        if (reservePctValue !== undefined) newData.reservePct = reservePctValue

        const client = await prisma.$transaction(async (tx) => {
            const updated = await tx.client.update({ where: { id }, data: newData })

            // Update client-level supervisor assignment if one was sent
            // (validates the user, dedups prior ACTIVE — see assignSupervisor).
            const newSupervisorId = body.assignedSupervisorId ? String(body.assignedSupervisorId).trim() : ""
            if (newSupervisorId) {
                await assignSupervisor(tx, { clientId: id, supervisorId: newSupervisorId })
            }

            return updated
        })

        // Build audit diff against existing client and log (non-critical, outside tx)
        const changeSummary = buildChangeSummary(
            existingClient as unknown as Record<string, unknown>,
            client as unknown as Record<string, unknown>
        )
        await safeAuditLog({
            userId: actorId,
            event: "CLIENT_UPDATED",
            module: "CLIENTS",
            description: `Client ${id} updated by ${actorName}. Changes: ${changeSummary}`,
            targetEntityType: "Client",
            targetEntityId: id,
            targetRegionId: client.regionId ?? existingClient.regionId ?? null,
            targetRegionalOfficeId: client.regionalOfficeId ?? existingClient.regionalOfficeId ?? null,
        })

        return NextResponse.json(client, { status: 200 })
    } catch (error: unknown) {
        // A bad supervisorId surfaces from assignSupervisor as a "not found" error.
        if (error instanceof Error && error.message.startsWith("Supervisor user not found")) {
            return badRequest("Assigned supervisor not found.")
        }
        console.error("Error updating client:", error)
        return internalServerError("Failed to update client")
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasAction(session, "CLIENTS", "UPDATE")) return forbidden("Access denied.")
        // Changing the client status is a GLOBAL-only action (region-less clients, B1).
        if (!isSuperAdmin(session)) {
            return forbidden("Forbidden: changing client status requires global access.")
        }
        const managerScope = deriveManagerScope(session)
        const actorId = session.user?.id || null
        const actorName = session.user?.name || session.user?.email || actorId || "Unknown"

        const { id } = await params
        const body = await request.json()

        const existingClient = await prisma.client.findUnique({
            where: { id },
            select: { regionId: true, regionalOfficeId: true },
        })
        if (!existingClient) return notFound("Client not found")
        // Branch-aware scope guard (branchful → by branches, branchless → own region).
        if (managerScope && !(await clientInScope(id, managerScope))) {
            return forbidden("Forbidden: client is outside your scope.")
        }

        const status = body?.status ? String(body.status) : null
        if (!status || !["ACTIVE", "INACTIVE"].includes(status)) {
            return badRequest("Status must be ACTIVE or INACTIVE.")
        }

        // Ticket 33 — block client deactivation while any branch is still ACTIVE.
        // Workflow rule defaults ON; admins can opt out.
        if (
            status === "INACTIVE" &&
            isWorkflowRuleEnabled("branches.requireInactiveBranchesBeforeClientInactive")
        ) {
            const activeBranch = await prisma.branch.findFirst({
                where: { clientId: id, status: "ACTIVE" },
                select: { id: true },
            })
            if (activeBranch) {
                return conflict(
                    "Cannot deactivate client while branches are still active. Deactivate or remove all branches first."
                )
            }
        }

        const updated = await prisma.client.update({ where: { id }, data: { status } })
        await safeAuditLog({
            userId: actorId,
            event: "CLIENT_STATUS_UPDATED",
            module: "CLIENTS",
            description: `Client ${id} status changed to ${status} by ${actorName}.`,
            targetEntityType: "Client",
            targetEntityId: id,
            targetRegionId: existingClient.regionId ?? null,
            targetRegionalOfficeId: existingClient.regionalOfficeId ?? null,
        })

        return NextResponse.json(updated)
    } catch (error: unknown) {
        console.error("Error updating client status:", error)
        return internalServerError("Failed to update client status")
    }
}
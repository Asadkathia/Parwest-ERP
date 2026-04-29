import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, conflict, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"

const toInt = (v: unknown) => { const n = parseInt(String(v ?? ""), 10); return isNaN(n) ? null : n }
const toFloat = (v: unknown) => { const n = parseFloat(String(v ?? "")); return isNaN(n) ? null : n }

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
        const managerScope = deriveManagerScope(session)
        const actorId = session.user?.id || null
        const actorName = session.user?.name || session.user?.email || actorId || "Unknown"

        const { id } = await params
        const body = await request.json()

        const existingClient = await prisma.client.findUnique({ where: { id } })

        if (!existingClient) {
            return notFound("Client not found")
        }
        if (managerScope && managerScopeDenied(managerScope, { regionId: existingClient.regionId })) {
            return forbidden("Forbidden: client is outside your scope.")
        }
        const bodyRegionId = body?.regionId ? String(body.regionId) : null
        if (managerScope && managerScopeDenied(managerScope, { regionId: bodyRegionId })) {
            return forbidden("Forbidden: cannot move client outside your scope.")
        }

        // Resolve city — form sends it as `clientLocation`
        const city = body.clientLocation || body.city || null

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

        const newData = {
            name:                        body.name,
            type:                        body.type,
            email:                       body.email                       || null,
            enrollmentDate:              body.enrollmentDate ? new Date(body.enrollmentDate) : existingClient.enrollmentDate,
            regionId:                    body.regionId                    || null,
            regionalOfficeId:            body.regionalOfficeId            || null,
            city,
            status:                      body.status                      || "ACTIVE",
            isBranchless:                body.isBranchless === true || body.isBranchless === "true",
            headOfficeAddress:           body.headOfficeAddress           || null,
            ntn:                         body.ntn                         || null,
            strn:                        body.strn                        || null,
            logoUrl:                     body.logoUrl                     || null,
            // Contact
            contactPerson:               body.contactPerson               || null,
            contactPersonDesignation:    body.contactPersonDesignation    || null,
            phone:                       body.contactNumber               || null,
            contactNumbers:              Array.isArray(body.contactNumbers) && body.contactNumbers.length > 0
                                             ? body.contactNumbers : undefined,
            postalCode:                  body.clientPostalCode            || null,
            // Introducer
            introducerName:              body.introducerName              || null,
            introducerContactNumber:     body.introducerContactNumber     || null,
            introducerAddress:           body.introducerAddress           || null,
            introducerCnic:              body.introducerCnicNumber        || null,
            // Operational
            operationalProvinces:        body.operationalProvinces        || null,
            // Assigned
            assignedManagerId:           body.assignedManagerId           || null,
            // Contract
            contractStart:               body.contractStart      ? new Date(body.contractStart)      : null,
            contractEnd:                 body.contractEnd        ? new Date(body.contractEnd)        : null,
            contractRateStart:           body.contractRateStart  ? new Date(body.contractRateStart)  : null,
            contractRateEnd:             body.contractRateEnd    ? new Date(body.contractRateEnd)    : null,
            contractDayGuardDesignation:   body.contractDayGuardDesignation   || null,
            contractDayGuardExService:     body.contractDayGuardExService     || null,
            contractNightGuardDesignation: body.contractNightGuardDesignation || null,
            contractNightGuardExService:   body.contractNightGuardExService   || null,
            contractAdditionalDayGuards:   toInt(body.contractAdditionalDayGuards),
            contractAdditionalNightGuards: toInt(body.contractAdditionalNightGuards),
            contractPrice:               toFloat(body.contractPrice),
            ...(reservePctValue !== undefined ? { reservePct: reservePctValue } : {}),
        }

        const client = await prisma.$transaction(async (tx) => {
            const updated = await tx.client.update({ where: { id }, data: newData })

            // Update supervisor assignment if changed
            const newSupervisorId = body.assignedSupervisorId ? String(body.assignedSupervisorId).trim() : ""
            if (newSupervisorId) {
                // Deactivate existing active assignments at client level (no branch)
                await tx.clientSupervisorAssignment.updateMany({
                    where: { clientId: id, branchId: null, status: "ACTIVE" },
                    data: { status: "INACTIVE" },
                })
                await tx.clientSupervisorAssignment.create({
                    data: { clientId: id, supervisorId: newSupervisorId },
                }).catch(() => { /* ignore if user not found */ })
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
        })

        return NextResponse.json(client, { status: 200 })
    } catch (error: unknown) {
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
        if (managerScope && managerScopeDenied(managerScope, { regionId: existingClient.regionId, regionalOfficeId: existingClient.regionalOfficeId })) {
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
        })

        return NextResponse.json(updated)
    } catch (error: unknown) {
        console.error("Error updating client status:", error)
        return internalServerError("Failed to update client status")
    }
}
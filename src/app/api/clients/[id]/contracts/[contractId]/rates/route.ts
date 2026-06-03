import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, conflict, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { checkClientScope } from "@/lib/clients/access"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { PROVINCE_VALUES, type ProvinceValue } from "@/lib/geo/province-constants"

const SCOPE_LEVELS = ["BRANCH", "REGION", "PROVINCE", "GLOBAL"] as const
type ScopeLevel = (typeof SCOPE_LEVELS)[number]

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; contractId: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasAction(session, "CLIENTS", "CREATE")) return forbidden("Access denied.")
        const { id: clientId, contractId } = await params

        const scope = await checkClientScope(clientId, session)
        if (scope === "not_found") return notFound("Client not found.")
        if (scope === "forbidden") return forbidden("Access denied.")

        const rawActorId = session.user?.id || null
        const actorName = session.user?.name || session.user?.email || rawActorId || "Unknown"
        const actorId = rawActorId
            ? (await prisma.user.findUnique({ where: { id: rawActorId }, select: { id: true } }))?.id ?? null
            : null

        const body = await request.json()

        // ---- Scope validation: explicit scope columns are now authoritative ----
        const scopeLevel = String(body?.scopeLevel || "").trim() as ScopeLevel
        if (!SCOPE_LEVELS.includes(scopeLevel)) {
            return badRequest("scopeLevel must be one of BRANCH, REGION, PROVINCE, GLOBAL.")
        }

        const scopeBranchId = body?.scopeBranchId ? String(body.scopeBranchId).trim() : null
        const scopeRegionId = body?.scopeRegionId ? String(body.scopeRegionId).trim() : null
        const scopeProvinceRaw = body?.scopeProvince ? String(body.scopeProvince).trim() : null

        // EXACTLY ONE target must be set, matching the scope level.
        switch (scopeLevel) {
            case "BRANCH":
                if (!scopeBranchId || scopeRegionId || scopeProvinceRaw) {
                    return badRequest("BRANCH scope requires only scopeBranchId.")
                }
                break
            case "REGION":
                if (!scopeRegionId || scopeBranchId || scopeProvinceRaw) {
                    return badRequest("REGION scope requires only scopeRegionId.")
                }
                break
            case "PROVINCE":
                if (!scopeProvinceRaw || scopeBranchId || scopeRegionId) {
                    return badRequest("PROVINCE scope requires only scopeProvince.")
                }
                if (!PROVINCE_VALUES.includes(scopeProvinceRaw as ProvinceValue)) {
                    return badRequest("scopeProvince must be a valid Province value.")
                }
                break
            case "GLOBAL":
                if (scopeBranchId || scopeRegionId || scopeProvinceRaw) {
                    return badRequest("GLOBAL scope must not set a scope target.")
                }
                break
        }
        const scopeProvince = scopeLevel === "PROVINCE" ? (scopeProvinceRaw as ProvinceValue) : null

        const rate = parseFloat(String(body?.rate ?? ""))
        if (isNaN(rate)) return badRequest("Rate must be a number.")
        if (rate < 0) return badRequest("Rate cannot be negative.")

        // guardType / exService are now OPTIONAL decorative labels — they do NOT
        // participate in scope identity. exService is nullable in the schema;
        // guardType is a non-null column so it defaults to "" when omitted.
        const guardType = body?.guardType ? String(body.guardType).trim() : ""
        const exService = body?.exService ? String(body.exService).trim() || null : null

        // SECURITY: bind contract lookup to the path clientId to prevent cross-tenant
        // rate writes (IDOR). The scope gate above validates clientId is in-scope;
        // binding the contract to that clientId blocks adding rates to another
        // client's contract via an in-scope client id in the URL.
        const contract = await prisma.clientContract.findFirst({
            where: { id: contractId, clientId },
            select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                client: { select: { regionId: true } },
            },
        })
        if (!contract) return notFound("Contract not found")

        // ---- IDOR on scope targets ----
        if (scopeLevel === "BRANCH") {
            // The branch must belong to THIS client.
            const branch = await prisma.branch.findFirst({
                where: { id: scopeBranchId!, clientId },
                select: { id: true },
            })
            if (!branch) return badRequest("scopeBranchId does not belong to this client.")
        } else if (scopeLevel === "REGION") {
            // REGION IDOR: the region must be inside THIS client's footprint, not
            // merely exist. Reachable = the client's own regionId UNION the
            // regions of the client's branches' regional offices. (Branch carries
            // only a scalar regionalOfficeId — no region relation — so we resolve
            // the offices' regionIds in a second lookup.) Binding to the footprint
            // blocks writing a rate scoped to an arbitrary region id.
            const branches = await prisma.branch.findMany({
                where: { clientId, regionalOfficeId: { not: null } },
                select: { regionalOfficeId: true },
            })
            const officeIds = [...new Set(branches.map((b) => b.regionalOfficeId).filter(Boolean) as string[])]
            const offices = officeIds.length
                ? await prisma.regionalOffice.findMany({
                    where: { id: { in: officeIds } },
                    select: { regionId: true },
                })
                : []
            const allowed = new Set(
                [contract.client?.regionId, ...offices.map((o) => o.regionId)].filter(Boolean),
            )
            if (!allowed.has(scopeRegionId)) {
                return badRequest("Region is not in this client's footprint.")
            }
        }

        // BILLING INTEGRITY: rate window must fall within the contract's date
        // boundaries (legacy rule). Only validated when the relevant dates are
        // present — rates and contracts may both have open-ended windows.
        const rateStartDate = body?.rateStartDate ? new Date(body.rateStartDate) : null
        const rateEndDate = body?.rateEndDate ? new Date(body.rateEndDate) : null
        if (rateStartDate && isNaN(rateStartDate.getTime())) return badRequest("rateStartDate is not a valid date.")
        if (rateEndDate && isNaN(rateEndDate.getTime())) return badRequest("rateEndDate is not a valid date.")
        if (rateStartDate && rateEndDate && rateEndDate.getTime() < rateStartDate.getTime()) {
            return badRequest("Rate end date cannot be before rate start date.")
        }
        if (contract.startDate && rateStartDate && rateStartDate.getTime() < contract.startDate.getTime()) {
            return badRequest("Rate start date cannot be before the contract start date.")
        }
        if (contract.endDate && rateEndDate && rateEndDate.getTime() > contract.endDate.getTime()) {
            return badRequest("Rate end date cannot be after the contract end date.")
        }
        // An open-ended rate (no end date) cannot extend past a bounded contract.
        if (contract.endDate && rateStartDate && rateStartDate.getTime() > contract.endDate.getTime()) {
            return badRequest("Rate start date cannot be after the contract end date.")
        }

        const isCurrent = body?.isCurrentRate === true

        let newRate
        try {
            newRate = await prisma.$transaction(async (tx) => {
                // ORDER MATTERS: with the partial unique index keyed on the scope
                // combo, demote any existing current row for this SAME scope combo
                // BEFORE creating the new current row, otherwise two current rows
                // momentarily coexist and violate the index inside the transaction.
                // Scope identity = {contractId, scopeLevel, scopeBranchId,
                // scopeRegionId, scopeProvince}. guardType/exService are decorative
                // and do NOT participate in identity.
                if (isCurrent) {
                    await tx.clientContractRate.updateMany({
                        where: {
                            contractId,
                            scopeLevel,
                            scopeBranchId,
                            scopeRegionId,
                            scopeProvince,
                            isCurrentRate: true,
                        },
                        data: { isCurrentRate: false },
                    })
                }

                return tx.clientContractRate.create({
                    data: {
                        contractId,
                        // Legacy province/city columns are intentionally NOT set —
                        // they are superseded by the explicit scope columns and
                        // are dropped in a later task.
                        scopeLevel,
                        scopeBranchId,
                        scopeRegionId,
                        scopeProvince,
                        guardType,
                        exService,
                        rate,
                        extraHourRate: body?.extraHourRate ? parseFloat(String(body.extraHourRate)) || null : null,
                        isCurrentRate: isCurrent,
                        rateStartDate,
                        rateEndDate,
                    },
                })
            })
        } catch (txError) {
            if (String((txError as { code?: string }).code) === "P2002") {
                return conflict("A current rate already exists for this contract/scope combination.")
            }
            throw txError
        }

        await safeAuditLog({
            userId: actorId,
            event: "CONTRACT_RATE_ADDED",
            module: "CLIENTS",
            description: `Rate added to contract "${contract.name}" (${contractId}) for client ${clientId} — scope ${scopeLevel}${scopeBranchId ? ` branch:${scopeBranchId}` : scopeRegionId ? ` region:${scopeRegionId}` : scopeProvince ? ` province:${scopeProvince}` : ""} @ PKR ${rate}. By: ${actorName}`,
            targetEntityType: "Client",
            targetEntityId: clientId,
        })

        return NextResponse.json(newRate, { status: 201 })
    } catch (error) {
        console.error("Error creating rate:", error)
        return internalServerError("Failed to create rate")
    }
}

/** PATCH — mark a rate as the current rate for its scope combo */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; contractId: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasAction(session, "CLIENTS", "UPDATE")) return forbidden("Access denied.")
        const { id: clientId, contractId } = await params

        const scope = await checkClientScope(clientId, session)
        if (scope === "not_found") return notFound("Client not found.")
        if (scope === "forbidden") return forbidden("Access denied.")

        const rawActorId = session.user?.id || null
        const actorName = session.user?.name || session.user?.email || rawActorId || "Unknown"
        const actorId = rawActorId
            ? (await prisma.user.findUnique({ where: { id: rawActorId }, select: { id: true } }))?.id ?? null
            : null

        const body = await request.json()
        const rateId = body?.rateId ? String(body.rateId) : null
        if (!rateId) return badRequest("rateId is required.")

        // SECURITY: resolve contract via {id, clientId} FIRST to prevent cross-tenant
        // rate edits (IDOR). The scope gate above validates clientId is in-scope;
        // binding the contract to that clientId blocks mark-current on another
        // client's contract via an in-scope client id in the URL.
        const contract = await prisma.clientContract.findFirst({
            where: { id: contractId, clientId },
            select: { name: true },
        })
        if (!contract) return notFound("Contract not found")

        const rate = await prisma.clientContractRate.findFirst({
            where: { id: rateId, contractId },
        })
        if (!rate) return notFound("Rate not found")

        try {
            await prisma.$transaction(async (tx) => {
                // Demote the existing current row for the SAME scope combo before
                // promoting the target, so the partial unique index keyed on the
                // scope combo is never violated. Scope identity = {contractId,
                // scopeLevel, scopeBranchId, scopeRegionId, scopeProvince}.
                await tx.clientContractRate.updateMany({
                    where: {
                        contractId,
                        scopeLevel: rate.scopeLevel,
                        scopeBranchId: rate.scopeBranchId,
                        scopeRegionId: rate.scopeRegionId,
                        scopeProvince: rate.scopeProvince,
                        isCurrentRate: true,
                    },
                    data: { isCurrentRate: false },
                })
                await tx.clientContractRate.update({
                    where: { id: rateId },
                    data: { isCurrentRate: true },
                })
            })
        } catch (txError) {
            if (String((txError as { code?: string }).code) === "P2002") {
                return conflict("A current rate already exists for this contract/scope combination.")
            }
            throw txError
        }

        await safeAuditLog({
            userId: actorId,
            event: "CONTRACT_RATE_MARKED_CURRENT",
            module: "CLIENTS",
            description: `Rate ${rateId} marked as current in contract "${contract.name}" (${contractId}) for client ${clientId} — scope ${rate.scopeLevel ?? "n/a"} @ PKR ${rate.rate}. By: ${actorName}`,
            targetEntityType: "Client",
            targetEntityId: clientId,
        })

        // Return updated rates for this contract
        const updatedRates = await prisma.clientContractRate.findMany({
            where: { contractId },
            orderBy: [{ createdAt: "asc" }],
        })

        return NextResponse.json(updatedRates)
    } catch (error) {
        console.error("Error marking rate as current:", error)
        return internalServerError("Failed to update rate")
    }
}

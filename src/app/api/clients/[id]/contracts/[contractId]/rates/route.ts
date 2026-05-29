import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, conflict, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { checkClientScope } from "@/lib/clients/access"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"

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
        const guardType = String(body?.guardType || "").trim()
        if (!guardType) return badRequest("Guard type is required.")
        const rate = parseFloat(String(body?.rate ?? ""))
        if (isNaN(rate)) return badRequest("Rate must be a number.")

        const exService = String(body?.exService || "").trim()
        if (!exService) return badRequest("Ex-service selection is required.")

        // SECURITY: bind contract lookup to the path clientId to prevent cross-tenant
        // rate writes (IDOR). The scope gate above validates clientId is in-scope;
        // binding the contract to that clientId blocks adding rates to another
        // client's contract via an in-scope client id in the URL.
        const contract = await prisma.clientContract.findFirst({
            where: { id: contractId, clientId },
            select: {
                id: true,
                name: true,
                branchId: true,
                startDate: true,
                endDate: true,
                branch: { select: { province: true, city: true } },
                client: { select: { operationalProvinces: true, region: { select: { name: true } } } },
            },
        })
        if (!contract) return notFound("Contract not found")

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

        // Province/city are authoritative: derived from the contract's branch
        // (branch-specific) or the client's territory + region (client-level).
        const derivedProvince = contract.branchId
            ? (contract.branch?.province ?? null)
            : (contract.client?.operationalProvinces ?? null)
        const derivedCity = contract.branchId
            ? (contract.branch?.city ?? null)
            : (contract.client?.region?.name ?? null)

        const isCurrent = body?.isCurrentRate === true

        let newRate
        try {
            newRate = await prisma.$transaction(async (tx) => {
                // ORDER MATTERS: with the partial unique index
                // `ClientContractRate_current_combo_key`, demote any existing
                // current row for this combo BEFORE creating the new current row,
                // otherwise two current rows momentarily coexist and violate the
                // index inside the transaction. Match the FULL combo, INCLUDING
                // guardType, so we only demote the row this new one replaces.
                if (isCurrent) {
                    await tx.clientContractRate.updateMany({
                        where: {
                            contractId,
                            guardType,
                            exService,
                            province: derivedProvince,
                            city: derivedCity,
                            isCurrentRate: true,
                        },
                        data: { isCurrentRate: false },
                    })
                }

                return tx.clientContractRate.create({
                    data: {
                        contractId,
                        province: derivedProvince,
                        city: derivedCity,
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
                return conflict("A current rate already exists for this contract/location/guard-type combination.")
            }
            throw txError
        }

        await safeAuditLog({
            userId: actorId,
            event: "CONTRACT_RATE_ADDED",
            module: "CLIENTS",
            description: `Rate added to contract "${contract.name}" (${contractId}) for client ${clientId} — ${guardType} / ${exService} @ PKR ${rate}. By: ${actorName}`,
            targetEntityType: "Client",
            targetEntityId: clientId,
        })

        return NextResponse.json(newRate, { status: 201 })
    } catch (error) {
        console.error("Error creating rate:", error)
        return internalServerError("Failed to create rate")
    }
}

/** PATCH — mark a rate as the current rate for its guardType+exService combo */
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
                // Demote the existing current row for the SAME combo (including
                // guardType) before promoting the target, so the partial unique
                // index `ClientContractRate_current_combo_key` is never violated.
                await tx.clientContractRate.updateMany({
                    where: {
                        contractId,
                        guardType: rate.guardType,
                        exService: rate.exService,
                        province: rate.province,
                        city: rate.city,
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
                return conflict("A current rate already exists for this contract/location/guard-type combination.")
            }
            throw txError
        }

        await safeAuditLog({
            userId: actorId,
            event: "CONTRACT_RATE_MARKED_CURRENT",
            module: "CLIENTS",
            description: `Rate ${rateId} marked as current in contract "${contract.name}" (${contractId}) for client ${clientId} — ${rate.guardType} / ${rate.exService || "any"} @ PKR ${rate.rate}. By: ${actorName}`,
            targetEntityType: "Client",
            targetEntityId: clientId,
        })

        // Return updated rates for this contract
        const updatedRates = await prisma.clientContractRate.findMany({
            where: { contractId },
            orderBy: [{ guardType: "asc" }, { createdAt: "asc" }],
        })

        return NextResponse.json(updatedRates)
    } catch (error) {
        console.error("Error marking rate as current:", error)
        return internalServerError("Failed to update rate")
    }
}

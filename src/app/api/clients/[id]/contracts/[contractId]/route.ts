import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { checkClientScope } from "@/lib/clients/access"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"

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
        // SECURITY: bind contract lookup to the path clientId to prevent cross-tenant
        // edits (IDOR). The scope gate above validates clientId is in-scope; binding
        // the contract to that clientId blocks editing another client's contract via
        // an in-scope client id in the URL.
        const contract = await prisma.clientContract.findFirst({ where: { id: contractId, clientId } })
        if (!contract) return notFound("Contract not found")

        const name = body?.name ? String(body.name).trim() : contract.name
        if (!name) return badRequest("Contract name is required.")

        // Resolve the effective window after this edit (fall back to existing
        // values when a date isn't supplied in the payload).
        const startDate = body?.startDate ? new Date(body.startDate) : contract.startDate
        const endDate = body?.endDate ? new Date(body.endDate) : contract.endDate
        if (body?.startDate && startDate && isNaN(startDate.getTime())) return badRequest("startDate is not a valid date.")
        if (body?.endDate && endDate && isNaN(endDate.getTime())) return badRequest("endDate is not a valid date.")

        // BILLING INTEGRITY: when both dates are present, the contract window
        // must remain valid — end at least one day after start (legacy rule).
        if (startDate && endDate) {
            const oneDayMs = 24 * 60 * 60 * 1000
            if (endDate.getTime() - startDate.getTime() < oneDayMs) {
                return badRequest("Contract end date must be at least one day after the start date.")
            }
        }

        // BILLING INTEGRITY: reject shrinking the contract window such that any
        // existing rate's window would fall outside it. Only relevant when the
        // window is actually changing and the contract has dated rates.
        const datesChanging =
            (body?.startDate !== undefined && startDate?.getTime() !== contract.startDate?.getTime()) ||
            (body?.endDate !== undefined && endDate?.getTime() !== contract.endDate?.getTime())
        if (datesChanging && (startDate || endDate)) {
            const rates = await prisma.clientContractRate.findMany({
                where: {
                    contractId,
                    OR: [{ rateStartDate: { not: null } }, { rateEndDate: { not: null } }],
                },
                select: { rateStartDate: true, rateEndDate: true },
            })
            for (const r of rates) {
                if (startDate && r.rateStartDate && r.rateStartDate.getTime() < startDate.getTime()) {
                    return badRequest(
                        "Cannot move the contract start date later than an existing rate's start date. Adjust the affected rate windows first."
                    )
                }
                if (endDate && r.rateEndDate && r.rateEndDate.getTime() > endDate.getTime()) {
                    return badRequest(
                        "Cannot move the contract end date earlier than an existing rate's end date. Adjust the affected rate windows first."
                    )
                }
                // An open-ended rate (start only) cannot start after a shrunk contract end.
                if (endDate && r.rateStartDate && r.rateStartDate.getTime() > endDate.getTime()) {
                    return badRequest(
                        "Cannot move the contract end date earlier than an existing rate's start date. Adjust the affected rate windows first."
                    )
                }
            }
        }

        const updated = await prisma.clientContract.update({
            where: { id: contractId },
            data: {
                name,
                type: body?.type ? String(body.type).toUpperCase() : contract.type,
                startDate,
                endDate,
                isActive: body?.isActive !== undefined ? Boolean(body.isActive) : contract.isActive,
            },
            include: {
                branch: { select: { id: true, name: true } },
                rates: { orderBy: [{ guardType: "asc" }, { createdAt: "asc" }] },
            },
        })

        await safeAuditLog({
            userId: actorId,
            event: "CONTRACT_UPDATED",
            module: "CLIENTS",
            description: `Contract "${name}" (${contractId}) updated for client ${clientId}. By: ${actorName}`,
            targetEntityType: "Client",
            targetEntityId: clientId,
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error("Error updating contract:", error)
        return internalServerError("Failed to update contract")
    }
}

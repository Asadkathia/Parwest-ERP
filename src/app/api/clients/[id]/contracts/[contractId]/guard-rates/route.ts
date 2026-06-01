import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { checkClientScope } from "@/lib/clients/access"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"

/**
 * GET — list the client's enrolled guards joined with any per-guard contract
 * rate for this DYNAMIC contract.
 *
 * "Enrolled" = the guard has at least one Deployment under this client.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string; contractId: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasAction(session, "CLIENTS", "VIEW")) return forbidden("Access denied.")
        const { id: clientId, contractId } = await params

        const scope = await checkClientScope(clientId, session)
        if (scope === "not_found") return notFound("Client not found.")
        if (scope === "forbidden") return forbidden("Access denied.")

        // SECURITY: bind contract lookup to the path clientId to prevent
        // cross-tenant reads (IDOR). The scope gate validates clientId is
        // in-scope; binding the contract to that clientId blocks reading
        // another client's contract via an in-scope client id in the URL.
        const contract = await prisma.clientContract.findFirst({
            where: { id: contractId, clientId },
            select: { id: true, billingMode: true },
        })
        if (!contract) return notFound("Contract not found")
        if (contract.billingMode !== "DYNAMIC") return badRequest("Not a dynamic contract.")

        // Enrolled guards: any guard with at least one deployment under this client.
        const deployments = await prisma.deployment.findMany({
            where: { clientId },
            distinct: ["guardId"],
            select: { guard: { select: { id: true, parwestId: true, name: true } } },
        })

        // Existing per-guard rates for this contract.
        const guardRates = await prisma.contractGuardRate.findMany({
            where: { contractId },
            select: { id: true, guardId: true, rate: true, extraHourRate: true },
        })
        const rateByGuardId = new Map(guardRates.map((r) => [r.guardId, r]))

        // De-dupe by guardId (distinct should already guarantee this, but the
        // guard relation is the source of truth and null guards are dropped).
        const seen = new Set<string>()
        const result: Array<{
            guardId: string
            parwestId: string | null
            name: string
            rate: number | null
            extraHourRate: number | null
            contractGuardRateId: string | null
        }> = []
        for (const d of deployments) {
            const g = d.guard
            if (!g || seen.has(g.id)) continue
            seen.add(g.id)
            const existing = rateByGuardId.get(g.id)
            result.push({
                guardId: g.id,
                parwestId: g.parwestId ?? null,
                name: g.name,
                rate: existing?.rate ?? null,
                extraHourRate: existing?.extraHourRate ?? null,
                contractGuardRateId: existing?.id ?? null,
            })
        }

        return NextResponse.json(result)
    } catch (error) {
        console.error("Error listing contract guard rates:", error)
        return internalServerError("Failed to list guard rates")
    }
}

/**
 * POST — upsert a single guard's per-guard rate for this DYNAMIC contract.
 */
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
        const guardId = String(body?.guardId || "").trim()
        if (!guardId) return badRequest("guardId is required.")

        const rate = Number(body?.rate)
        if (!Number.isFinite(rate) || rate < 0) return badRequest("Rate must be a finite number ≥ 0.")

        let extraHourRate: number | null = null
        if (body?.extraHourRate !== undefined && body?.extraHourRate !== null && body?.extraHourRate !== "") {
            const ehr = Number(body.extraHourRate)
            if (!Number.isFinite(ehr) || ehr < 0) return badRequest("Extra hour rate must be a finite number ≥ 0.")
            extraHourRate = ehr
        }

        // SECURITY: resolve contract via {id, clientId} FIRST to prevent
        // cross-tenant rate writes (IDOR). The scope gate validates clientId is
        // in-scope; binding the contract to that clientId blocks writing a rate
        // on another client's contract via an in-scope client id in the URL.
        const contract = await prisma.clientContract.findFirst({
            where: { id: contractId, clientId },
            select: { id: true, name: true, billingMode: true },
        })
        if (!contract) return notFound("Contract not found")
        if (contract.billingMode !== "DYNAMIC") return badRequest("Not a dynamic contract.")

        // The guard must be enrolled under this client (has a deployment here),
        // otherwise we'd allow setting a rate for an unrelated guard.
        const enrolled = await prisma.deployment.findFirst({
            where: { clientId, guardId },
            select: { id: true },
        })
        if (!enrolled) return badRequest("Guard is not enrolled under this client.")

        const upserted = await prisma.contractGuardRate.upsert({
            where: { contractId_guardId: { contractId, guardId } },
            create: { contractId, guardId, rate, extraHourRate },
            update: { rate, extraHourRate },
        })

        await safeAuditLog({
            userId: actorId,
            event: "CONTRACT_GUARD_RATE_SET",
            module: "CLIENTS",
            description: `Per-guard rate set on contract "${contract.name}" (${contractId}) for client ${clientId} — guard ${guardId} @ PKR ${rate}. By: ${actorName}`,
            targetEntityType: "Client",
            targetEntityId: clientId,
        })

        return NextResponse.json(upserted, { status: 201 })
    } catch (error) {
        console.error("Error upserting contract guard rate:", error)
        return internalServerError("Failed to set guard rate")
    }
}

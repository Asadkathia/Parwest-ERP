import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { checkClientScope } from "@/lib/clients/access"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasAction(session, "CLIENTS", "VIEW")) return forbidden("Access denied.")
        const { id: clientId } = await params

        const scope = await checkClientScope(clientId, session)
        if (scope === "not_found") return notFound("Client not found.")
        if (scope === "forbidden") return forbidden("Access denied.")

        const contracts = await prisma.clientContract.findMany({
            where: { clientId },
            include: {
                branch: { select: { id: true, name: true, province: true, city: true } },
                rates: { orderBy: [{ scopeLevel: "asc" }, { createdAt: "asc" }] },
            },
            orderBy: { createdAt: "desc" },
        })
        return NextResponse.json(contracts)
    } catch (error) {
        console.error("Error fetching contracts:", error)
        return internalServerError("Failed to fetch contracts")
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasAction(session, "CLIENTS", "CREATE")) return forbidden("Access denied.")
        const { id: clientId } = await params
        const body = await request.json()

        const scope = await checkClientScope(clientId, session)
        if (scope === "not_found") return notFound("Client not found.")
        if (scope === "forbidden") return forbidden("Access denied.")

        const rawActorId = session.user?.id || null
        const actorName = session.user?.name || session.user?.email || rawActorId || "Unknown"

        // Verify actor exists in User table — FK will fail otherwise (stale sessions, mock users)
        const actorId = rawActorId
            ? (await prisma.user.findUnique({ where: { id: rawActorId }, select: { id: true } }))?.id ?? null
            : null

        const name = String(body?.name || "").trim()
        if (!name) return badRequest("Contract name is required.")

        // BILLING INTEGRITY: when both dates are supplied, the contract window
        // must be valid — the end date has to be at least one day after the
        // start date (legacy rule). Open-ended contracts (missing either date)
        // are still allowed.
        const startDate = body?.startDate ? new Date(body.startDate) : null
        const endDate = body?.endDate ? new Date(body.endDate) : null
        if (startDate && isNaN(startDate.getTime())) return badRequest("startDate is not a valid date.")
        if (endDate && isNaN(endDate.getTime())) return badRequest("endDate is not a valid date.")
        if (startDate && endDate) {
            const oneDayMs = 24 * 60 * 60 * 1000
            if (endDate.getTime() - startDate.getTime() < oneDayMs) {
                return badRequest("Contract end date must be at least one day after the start date.")
            }
        }

        // Validate billingMode — only "MANUAL" and "DYNAMIC" are accepted.
        // Absent/null → default to "MANUAL". Any other explicit value is a bad request.
        const VALID_BILLING_MODES = ["MANUAL", "DYNAMIC"] as const
        type BillingMode = typeof VALID_BILLING_MODES[number]
        const rawBillingMode = body?.billingMode
        let billingMode: BillingMode = "MANUAL"
        if (rawBillingMode !== undefined && rawBillingMode !== null) {
            const normalised = String(rawBillingMode).toUpperCase()
            if (!VALID_BILLING_MODES.includes(normalised as BillingMode)) {
                return badRequest(`billingMode must be one of: ${VALID_BILLING_MODES.join(", ")}.`)
            }
            billingMode = normalised as BillingMode
        }

        // SECURITY: when branchId is supplied, verify the branch belongs to this
        // client to prevent attaching a client-level contract to another client's
        // branch (mirrors advance-payments POST guard).
        const branchId = body?.branchId ? String(body.branchId) : null
        if (branchId) {
            const branch = await prisma.branch.findUnique({
                where: { id: branchId },
                select: { id: true, clientId: true },
            })
            if (!branch || branch.clientId !== clientId) {
                return badRequest("branchId does not belong to this client.")
            }
        }

        const contract = await prisma.clientContract.create({
            data: {
                clientId,
                branchId,
                name,
                type: body?.type ? String(body.type).toUpperCase() : "GENERAL",
                billingMode,
                startDate,
                endDate,
                isActive: true,
            },
            include: {
                branch: { select: { id: true, name: true, province: true, city: true } },
                rates: true,
            },
        })

        // Audit log is non-critical — never fail the main operation on log errors
        await safeAuditLog({
            userId: actorId,
            event: "CONTRACT_CREATED",
            module: "CLIENTS",
            description: `Contract "${name}" created for client ${clientId}${branchId ? ` (branch ${branchId})` : ""}. By: ${actorName}`,
            targetEntityType: "Client",
            targetEntityId: clientId,
        })

        return NextResponse.json(contract, { status: 201 })
    } catch (error) {
        console.error("Error creating contract:", error)
        return internalServerError("Failed to create contract")
    }
}

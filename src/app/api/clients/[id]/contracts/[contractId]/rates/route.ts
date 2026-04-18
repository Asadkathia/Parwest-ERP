import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import type { Session } from "next-auth"

async function checkClientScope(clientId: string, session: Session) {
    const managerScope = deriveManagerScope(session)
    if (!managerScope) return null
    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { regionId: true, regionalOfficeId: true },
    })
    if (!client) return "not_found"
    if (managerScopeDenied(managerScope, { regionId: client.regionId, regionalOfficeId: client.regionalOfficeId })) return "forbidden"
    return null
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; contractId: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        const { id: clientId, contractId } = await params

        const scope = await checkClientScope(clientId, session)
        if (scope === "not_found") return notFound("Client not found.")
        if (scope === "forbidden") return forbidden("Access denied.")

        const actorId = session.user?.id || null
        const actorName = session.user?.name || session.user?.email || actorId || "Unknown"

        const body = await request.json()
        const guardType = String(body?.guardType || "").trim()
        if (!guardType) return badRequest("Guard type is required.")
        const rate = parseFloat(String(body?.rate ?? ""))
        if (isNaN(rate)) return badRequest("Rate must be a number.")

        const contract = await prisma.clientContract.findUnique({
            where: { id: contractId },
            select: { id: true, name: true },
        })
        if (!contract) return notFound("Contract not found")

        const newRate = await prisma.$transaction(async (tx) => {
            const created = await tx.clientContractRate.create({
                data: {
                    contractId,
                    province: body?.province ? String(body.province) : null,
                    city: body?.city ? String(body.city) : null,
                    guardType,
                    exService: body?.exService ? String(body.exService) : null,
                    rate,
                    extraHourRate: body?.extraHourRate ? parseFloat(String(body.extraHourRate)) || null : null,
                    isCurrentRate: body?.isCurrentRate === true,
                    rateStartDate: body?.rateStartDate ? new Date(body.rateStartDate) : null,
                    rateEndDate: body?.rateEndDate ? new Date(body.rateEndDate) : null,
                },
            })

            // If marked as current, deactivate other current rates for same guardType+exService in this contract
            if (body?.isCurrentRate === true) {
                await tx.clientContractRate.updateMany({
                    where: {
                        contractId,
                        guardType,
                        exService: body?.exService ? String(body.exService) : null,
                        isCurrentRate: true,
                        id: { not: created.id },
                    },
                    data: { isCurrentRate: false },
                })
            }

            await tx.auditLog.create({
                data: {
                    userId: actorId,
                    event: "CONTRACT_RATE_ADDED",
                    module: "CLIENTS",
                    description: `Rate added to contract "${contract.name}" (${contractId}) for client ${clientId} — ${guardType} / ${body?.exService || "any"} @ PKR ${rate}. By: ${actorName}`,
                },
            })

            return created
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
        const { id: clientId, contractId } = await params

        const scope = await checkClientScope(clientId, session)
        if (scope === "not_found") return notFound("Client not found.")
        if (scope === "forbidden") return forbidden("Access denied.")

        const actorId = session.user?.id || null
        const actorName = session.user?.name || session.user?.email || actorId || "Unknown"

        const body = await request.json()
        const rateId = body?.rateId ? String(body.rateId) : null
        if (!rateId) return badRequest("rateId is required.")

        const rate = await prisma.clientContractRate.findFirst({
            where: { id: rateId, contractId },
        })
        if (!rate) return notFound("Rate not found")

        const contract = await prisma.clientContract.findUnique({
            where: { id: contractId },
            select: { name: true },
        })

        await prisma.$transaction(async (tx) => {
            // Deactivate other current rates for same guardType+exService in this contract
            await tx.clientContractRate.updateMany({
                where: {
                    contractId,
                    guardType: rate.guardType,
                    exService: rate.exService,
                    isCurrentRate: true,
                },
                data: { isCurrentRate: false },
            })
            // Activate this rate
            await tx.clientContractRate.update({
                where: { id: rateId },
                data: { isCurrentRate: true },
            })

            await tx.auditLog.create({
                data: {
                    userId: actorId,
                    event: "CONTRACT_RATE_MARKED_CURRENT",
                    module: "CLIENTS",
                    description: `Rate ${rateId} marked as current in contract "${contract?.name}" (${contractId}) for client ${clientId} — ${rate.guardType} / ${rate.exService || "any"} @ PKR ${rate.rate}. By: ${actorName}`,
                },
            })
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

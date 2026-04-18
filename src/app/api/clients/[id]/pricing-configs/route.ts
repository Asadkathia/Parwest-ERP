import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()

        const { id } = await params

        const managerScope = deriveManagerScope(session)
        if (managerScope) {
            const client = await prisma.client.findUnique({
                where: { id },
                select: { regionId: true, regionalOfficeId: true },
            })
            if (!client) return notFound("Client not found.")
            if (managerScopeDenied(managerScope, { regionId: client.regionId, regionalOfficeId: client.regionalOfficeId })) {
                return forbidden("Access denied.")
            }
        }

        const configs = await prisma.pricingConfig.findMany({
            where: { clientId: id },
            orderBy: { guardType: "asc" },
            select: { id: true, guardType: true, rate: true },
        })

        return NextResponse.json(configs)
    } catch (error) {
        console.error("Error fetching pricing configs:", error)
        return internalServerError("Failed to fetch pricing configs")
    }
}

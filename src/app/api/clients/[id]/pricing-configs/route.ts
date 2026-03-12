import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { internalServerError, unauthorized } from "@/lib/api/response"

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()

        const { id } = await params

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

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params
        const body = await request.json()

        // Check if client exists
        const existingClient = await prisma.client.findUnique({
            where: { id },
        })

        if (!existingClient) {
            return NextResponse.json({ message: "Client not found" }, { status: 404 })
        }

        // Update client
        const client = await prisma.client.update({
            where: { id },
            data: {
                name: body.name,
                type: body.type,
                email: body.email || null,
                regionId: body.regionId || null,
                city: body.city || null,
                status: body.status || "ACTIVE",
                isBranchless: body.isBranchless || false,
                headOfficeAddress: body.headOfficeAddress || null,
                ntn: body.ntn || null,
                strn: body.strn || null,
                contractUrl: body.contractUrl || null,
                logoUrl: body.logoUrl || null,
            },
        })

        return NextResponse.json(client, { status: 200 })
    } catch (error: any) {
        console.error("Error updating client:", error)
        return NextResponse.json(
            { message: "Failed to update client" },
            { status: 500 }
        )
    }
}

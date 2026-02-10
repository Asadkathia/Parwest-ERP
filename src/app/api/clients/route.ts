import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const regionId = searchParams.get("regionId")
        const status = searchParams.get("status")

        const where: any = {}
        if (regionId) where.regionId = regionId
        if (status) where.status = status

        const clients = await prisma.client.findMany({
            where,
            orderBy: { name: "asc" },
            include: {
                region: true,
            },
        })

        return NextResponse.json(clients)
    } catch (error: any) {
        console.error("Error fetching clients:", error)
        return NextResponse.json(
            { message: "Failed to fetch clients" },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()

        const client = await prisma.client.create({
            data: {
                name: body.name,
                email: body.email || null,
                type: body.type,
                isBranchless: body.isBranchless === "true",
                headOfficeAddress: body.headOfficeAddress || null,
                city: body.city || null,
                status: body.status || "ACTIVE",
                logoUrl: body.logoUrl || null,
                ntn: body.ntn || null,
                strn: body.strn || null,
                contractUrl: body.contractUrl || null,
                regionId: body.regionId || null,
            },
        })

        return NextResponse.json(client, { status: 201 })
    } catch (error: any) {
        console.error("Error creating client:", error)
        return NextResponse.json(
            { message: "Failed to create client" },
            { status: 500 }
        )
    }
}

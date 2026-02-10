import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function GET() {
    try {
        const regionalOffices = await prisma.regionalOffice.findMany({
            include: {
                region: true,
            },
            orderBy: { name: "asc" },
        })
        return NextResponse.json(regionalOffices, { status: 200 })
    } catch (error: any) {
        console.error("Error fetching regional offices:", error)
        return NextResponse.json(
            { message: "Failed to fetch regional offices" },
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

        const regionalOffice = await prisma.regionalOffice.create({
            data: {
                name: body.name,
                seriesCode: body.seriesCode,
                regionId: body.regionId,
            },
            include: {
                region: true,
            },
        })

        return NextResponse.json(regionalOffice, { status: 201 })
    } catch (error: any) {
        console.error("Error creating regional office:", error)
        return NextResponse.json(
            { message: "Failed to create regional office" },
            { status: 500 }
        )
    }
}

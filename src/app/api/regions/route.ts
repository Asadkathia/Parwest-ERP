import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function GET() {
    try {
        const regions = await prisma.region.findMany({
            orderBy: { name: "asc" },
        })
        return NextResponse.json(regions, { status: 200 })
    } catch (error: any) {
        console.error("Error fetching regions:", error)
        return NextResponse.json(
            { message: "Failed to fetch regions" },
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

        const region = await prisma.region.create({
            data: {
                name: body.name,
            },
        })

        return NextResponse.json(region, { status: 201 })
    } catch (error: any) {
        console.error("Error creating region:", error)
        return NextResponse.json(
            { message: "Failed to create region" },
            { status: 500 }
        )
    }
}

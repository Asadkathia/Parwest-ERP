import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isMockEnabled } from "@/lib/mockData"

const MOCK_REGIONS = [
    { id: "mock-region-punjab", name: "Punjab", createdAt: "2026-02-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" },
    { id: "mock-region-sindh", name: "Sindh", createdAt: "2026-02-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" },
]

export async function GET() {
    try {
        if (isMockEnabled()) {
            return NextResponse.json(MOCK_REGIONS, { status: 200 })
        }

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
        const name = String(body?.name || "").trim()
        if (!name) {
            return NextResponse.json({ message: "Region name is required." }, { status: 400 })
        }

        if (isMockEnabled()) {
            return NextResponse.json(
                { id: `mock-region-${Date.now()}`, name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                { status: 201 }
            )
        }

        const region = await prisma.region.create({
            data: {
                name,
            },
        })

        return NextResponse.json(region, { status: 201 })
    } catch (error: any) {
        if (String(error?.code) === "P2002") {
            return NextResponse.json({ message: "Region already exists." }, { status: 409 })
        }
        console.error("Error creating region:", error)
        return NextResponse.json(
            { message: "Failed to create region" },
            { status: 500 }
        )
    }
}

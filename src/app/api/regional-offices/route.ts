import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isMockEnabled } from "@/lib/mockData"

const MOCK_OFFICES = [
    {
        id: "mock-office-lhr",
        name: "Lahore Head Office",
        seriesCode: "L",
        officeHead: "Admin",
        phone: "042-111",
        mobile: "0300-0000000",
        fax: "042-000",
        regionId: "mock-region-punjab",
        region: { id: "mock-region-punjab", name: "Punjab" },
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
    },
    {
        id: "mock-office-khi",
        name: "Karachi Office",
        seriesCode: "K",
        officeHead: "Manager KHI",
        phone: "021-111",
        mobile: "0301-0000000",
        fax: "021-000",
        regionId: "mock-region-sindh",
        region: { id: "mock-region-sindh", name: "Sindh" },
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
    },
]

export async function GET() {
    try {
        if (isMockEnabled()) {
            return NextResponse.json(MOCK_OFFICES, { status: 200 })
        }

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
        const name = String(body?.name || "").trim()
        const seriesCode = String(body?.seriesCode || "").trim().toUpperCase()
        const regionId = String(body?.regionId || "").trim()
        const officeHead = body?.officeHead ? String(body.officeHead) : null
        const phone = body?.phone ? String(body.phone) : null
        const mobile = body?.mobile ? String(body.mobile) : null
        const fax = body?.fax ? String(body.fax) : null

        if (!name || !seriesCode || !regionId) {
            return NextResponse.json({ message: "name, seriesCode and regionId are required." }, { status: 400 })
        }

        if (isMockEnabled()) {
            return NextResponse.json(
                {
                    id: `mock-office-${Date.now()}`,
                    name,
                    seriesCode,
                    officeHead,
                    phone,
                    mobile,
                    fax,
                    regionId,
                    region: { id: regionId, name: "Region" },
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                },
                { status: 201 }
            )
        }

        const regionalOffice = await prisma.regionalOffice.create({
            data: {
                name,
                seriesCode,
                regionId,
                officeHead,
                phone,
                mobile,
                fax,
            },
            include: {
                region: true,
            },
        })

        return NextResponse.json(regionalOffice, { status: 201 })
    } catch (error: any) {
        if (String(error?.code) === "P2002") {
            return NextResponse.json({ message: "Office name/series code already exists." }, { status: 409 })
        }
        if (String(error?.code) === "P2003") {
            return NextResponse.json({ message: "Invalid region selected." }, { status: 400 })
        }
        console.error("Error creating regional office:", error)
        return NextResponse.json(
            { message: "Failed to create regional office" },
            { status: 500 }
        )
    }
}

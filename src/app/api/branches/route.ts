import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()

        // Create branch
        const branch = await prisma.branch.create({
            data: {
                clientId: body.clientId,
                name: body.name,
                code: body.code || null,
                address: body.address || null,
                city: body.city || null,
                province: body.province || null,
                contactPerson: body.contactPerson || null,
                contactPhone: body.contactPhone || null,
                contactEmail: body.contactEmail || null,
                isHeadOffice: body.isHeadOffice || false,
            },
            include: {
                client: true,
            },
        })

        return NextResponse.json(branch, { status: 201 })
    } catch (error: any) {
        console.error("Error creating branch:", error)
        return NextResponse.json(
            { message: "Failed to create branch" },
            { status: 500 }
        )
    }
}

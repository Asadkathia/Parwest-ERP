import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { isMockEnabled } from "@/lib/mockData"
import { mockInactiveGuards } from "@/lib/mockData/guards"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        if (isMockEnabled()) {
            return NextResponse.json(mockInactiveGuards)
        }

        const guards = await prisma.guard.findMany({
            where: { status: "INACTIVE" },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                parwestId: true,
                name: true,
                updatedAt: true,
                status: true,
            },
            take: 200,
        })

        return NextResponse.json(guards)
    } catch (error: any) {
        if (isPrismaMissingSchemaError(error)) {
            return NextResponse.json([])
        }
        console.error("Error fetching inactive guards:", error)
        return NextResponse.json({ message: "Failed to fetch inactive guards" }, { status: 500 })
    }
}

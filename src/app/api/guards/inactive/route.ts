import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { mockInactiveGuards } from "@/lib/mockData/guards"
import { internalServerError, unauthorized } from "@/lib/api/response"

export async function GET() {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }

        if (isRuntimeMockEnabled()) {
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
    } catch (error: unknown) {
        if (isPrismaMissingSchemaError(error)) {
            return NextResponse.json([])
        }
        console.error("Error fetching inactive guards:", error)
        return internalServerError("Failed to fetch inactive guards")
    }
}

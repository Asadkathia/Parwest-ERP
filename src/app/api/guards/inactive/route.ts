import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { mockInactiveGuards } from "@/lib/mockData/guards"
import { forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasAction(session, "GUARDS", "VIEW")) return forbidden("Access denied.")

        const managerScope = deriveManagerScope(session)
        const { searchParams } = new URL(request.url)
        const regionId = searchParams.get("regionId")
        const regionalOfficeId = searchParams.get("regionalOfficeId")

        if (managerScopeDenied(managerScope, { regionId, regionalOfficeId })) {
            return forbidden("Forbidden: requested scope is outside your assigned region.")
        }

        if (isRuntimeMockEnabled()) {
            return NextResponse.json(mockInactiveGuards)
        }

        const scopeWhere = buildManagerScopeWhere(managerScope, { regionId: "regionId", regionalOfficeId: "regionalOfficeId" })
        const guards = await prisma.guard.findMany({
            where: {
                status: "INACTIVE",
                ...(regionId ? { regionId } : {}),
                ...(regionalOfficeId ? { regionalOfficeId } : {}),
                ...scopeWhere,
            },
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

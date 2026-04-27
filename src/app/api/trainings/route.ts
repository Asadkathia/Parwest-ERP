import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { hasAction } from "@/lib/api/permissions"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasAction(session, "GUARDS", "VIEW")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })

        const managerScope = deriveManagerScope(session)
        const { searchParams } = new URL(request.url)
        const regionId = searchParams.get("regionId")
        const regionalOfficeId = searchParams.get("regionalOfficeId")

        if (managerScopeDenied(managerScope, { regionId, regionalOfficeId })) {
            return forbidden("Forbidden: requested scope is outside your assigned region.")
        }

        const scopeFilter = buildManagerScopeWhere(managerScope, { regionId: "regionId", regionalOfficeId: "regionalOfficeId" })
        const guardFilter = {
            ...(regionId ? { regionId } : {}),
            ...(regionalOfficeId ? { regionalOfficeId } : {}),
            ...scopeFilter,
        }
        const trainings = await prisma.training.findMany({
            where: Object.keys(guardFilter).length > 0 ? { guard: { is: guardFilter } } : {},
            orderBy: { completedAt: "desc" },
            include: {
                guard: {
                    select: {
                        id: true,
                        name: true,
                        parwestId: true,
                        regionalOffice: { select: { name: true } },
                    },
                },
            },
            take: 300,
        })

        return NextResponse.json(trainings)
    } catch (error: unknown) {
        console.error("Error fetching trainings:", error)
        return internalServerError("Failed to fetch trainings")
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasAction(session, "GUARDS", "CREATE")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })

        const body = await request.json()

        if (!body.guardId || !body.trainingType || !body.completedAt) {
            return badRequest("guardId, trainingType and completedAt are required")
        }

        const trainingGuard = await prisma.guard.findUnique({
            where: { id: String(body.guardId) },
            select: { id: true, regionId: true, regionalOfficeId: true },
        })
        if (!trainingGuard) {
            return notFound("Guard not found.")
        }
        const trainingScope = deriveManagerScope(session)
        if (trainingScope && managerScopeDenied(trainingScope, {
            regionId: trainingGuard.regionId,
            regionalOfficeId: trainingGuard.regionalOfficeId,
        })) {
            return forbidden("Cannot create OJT training for a guard outside your regional scope.")
        }

        const training = await prisma.training.create({
            data: {
                guardId: body.guardId,
                trainingType: body.trainingType,
                completedAt: new Date(body.completedAt),
                instructor: body.instructor || null,
                notes: body.notes || null,
            },
            include: {
                guard: {
                    select: {
                        id: true,
                        name: true,
                        parwestId: true,
                    },
                },
            },
        })

        return NextResponse.json(training, { status: 201 })
    } catch (error: unknown) {
        console.error("Error creating training:", error)
        return internalServerError("Failed to create training")
    }
}

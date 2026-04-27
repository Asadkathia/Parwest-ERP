import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) return unauthorized()

        const managerScope = deriveManagerScope(session)
        const { searchParams } = new URL(request.url)
        const location = searchParams.get("location")?.trim()
        const status = searchParams.get("status")?.trim()
        const guardId = searchParams.get("guardId")?.trim()
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

        const assignments = await prisma.residenceAssignment.findMany({
            where: {
                ...(status ? { status } : {}),
                ...(guardId ? { guardId } : {}),
                ...(Object.keys(guardFilter).length > 0 ? { guard: { is: guardFilter } } : {}),
                ...(location
                    ? {
                        OR: [
                            { location: { contains: location, mode: "insensitive" } },
                            { residence: { address: { contains: location, mode: "insensitive" } } },
                        ],
                    }
                    : {}),
            },
            orderBy: { assignedAt: "desc" },
            include: {
                guard: {
                    select: { id: true, parwestId: true, name: true, cnic: true },
                },
                residence: {
                    select: { id: true, address: true, supervisor: true, city: true, state: true },
                },
            },
            take: 500,
        })

        return NextResponse.json(assignments)
    } catch (error: unknown) {
        console.error("Error fetching residence assignments:", error)
        return internalServerError("Failed to fetch residence assignments")
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) return unauthorized()

        const body = await request.json()

        if (!body.guardId || (!body.location && !body.residenceId)) {
            return badRequest("guardId and either location or residenceId are required")
        }

        const postScope = deriveManagerScope(session)
        if (postScope) {
            const guard = await prisma.guard.findUnique({
                where: { id: String(body.guardId) },
                select: { regionId: true, regionalOfficeId: true },
            })
            if (!guard) return notFound("Guard not found")
            if (managerScopeDenied(postScope, { regionId: guard.regionId, regionalOfficeId: guard.regionalOfficeId })) {
                return forbidden("Forbidden: guard is outside your scope.")
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sessionUser = (session as any)?.user as { name?: string; email?: string } | undefined
        const assignedByName = sessionUser?.name ?? sessionUser?.email ?? null

        const assignedAt = body.assignedAt ? new Date(body.assignedAt) : new Date()
        const selectedResidence = body.residenceId
            ? await prisma.residence.findUnique({
                where: { id: body.residenceId },
                select: { id: true, address: true },
            })
            : null

        if (body.residenceId && !selectedResidence) {
            return notFound("Residence not found")
        }

        const finalLocation = body.location || selectedResidence?.address
        if (!finalLocation) {
            return badRequest("Valid location is required")
        }

        // Vacate any existing active assignment for this guard
        await prisma.residenceAssignment.updateMany({
            where: { guardId: body.guardId, status: "ACTIVE" },
            data: {
                status: "VACATED",
                vacatedAt: assignedAt,
                vacatedByName: assignedByName,
                vacatedReason: "Reassigned to new residence",
            },
        })

        const assignment = await prisma.residenceAssignment.create({
            data: {
                guardId: body.guardId,
                residenceId: selectedResidence?.id || null,
                location: finalLocation,
                status: "ACTIVE",
                assignedAt,
                assignedByName,
                notes: body.notes || null,
            },
            include: {
                guard: { select: { id: true, parwestId: true, name: true } },
                residence: { select: { id: true, address: true } },
            },
        })

        return NextResponse.json(assignment, { status: 200 })
    } catch (error: unknown) {
        console.error("Error saving residence assignment:", error)
        return internalServerError("Failed to save residence assignment")
    }
}
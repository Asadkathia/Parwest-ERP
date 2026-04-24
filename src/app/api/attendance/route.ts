import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasAction(session, "GUARDS", "VIEW")) return forbidden("Access denied.")
        const managerScope = deriveManagerScope(session)

        const { searchParams } = new URL(request.url)
        const parwestId = searchParams.get("parwestId")?.trim()
        const guardId = searchParams.get("guardId")?.trim()
        const startDate = searchParams.get("startDate")
        const endDate = searchParams.get("endDate")

        let resolvedGuardId = guardId || undefined

        if (!resolvedGuardId && parwestId) {
            const guard = await prisma.guard.findFirst({
                where: { parwestId: { equals: parwestId, mode: "insensitive" } },
                select: { id: true },
            })
            resolvedGuardId = guard?.id

            if (!resolvedGuardId) {
                return NextResponse.json([])
            }
        }

        const scopeFilter = buildManagerScopeWhere(managerScope, { regionId: "regionId", regionalOfficeId: "regionalOfficeId" })
        const records = await prisma.attendance.findMany({
            where: {
                ...(resolvedGuardId ? { guardId: resolvedGuardId } : {}),
                ...(startDate || endDate
                    ? {
                        date: {
                            ...(startDate ? { gte: new Date(startDate) } : {}),
                            ...(endDate ? { lte: new Date(endDate) } : {}),
                        },
                    }
                    : {}),
                ...(Object.keys(scopeFilter).length > 0 ? { guard: { is: scopeFilter } } : {}),
            },
            orderBy: { date: "desc" },
            include: {
                guard: {
                    select: {
                        id: true,
                        parwestId: true,
                        name: true,
                        cnic: true,
                    },
                },
            },
            take: 500,
        })

        return NextResponse.json(records)
    } catch (error: unknown) {
        console.error("Error fetching attendance:", error)
        return internalServerError("Failed to fetch attendance")
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return unauthorized()
        }
        if (!hasAction(session, "GUARDS", "CREATE")) return forbidden("Access denied.")
        const managerScope = deriveManagerScope(session)

        const body = await request.json()

        if (!body.guardId || !body.date || !body.status) {
            return badRequest("guardId, date and status are required")
        }
        if (managerScope) {
            const guard = await prisma.guard.findUnique({
                where: { id: String(body.guardId) },
                select: { regionId: true, regionalOfficeId: true },
            })
            if (!guard) {
                return notFound("Guard not found")
            }
            if (managerScopeDenied(managerScope, { regionId: guard.regionId, regionalOfficeId: guard.regionalOfficeId })) {
                return forbidden("Forbidden: guard is outside your scope.")
            }
        }

        const attendanceDate = new Date(body.date)
        const normalizedDate = new Date(attendanceDate.getFullYear(), attendanceDate.getMonth(), attendanceDate.getDate())

        const attendance = await prisma.attendance.upsert({
            where: {
                guardId_date: {
                    guardId: body.guardId,
                    date: normalizedDate,
                },
            },
            update: {
                status: body.status,
                shiftType: body.shiftType || null,
                notes: body.notes || null,
            },
            create: {
                guardId: body.guardId,
                date: normalizedDate,
                status: body.status,
                shiftType: body.shiftType || null,
                notes: body.notes || null,
            },
            include: {
                guard: {
                    select: {
                        id: true,
                        parwestId: true,
                        name: true,
                    },
                },
            },
        })

        return NextResponse.json(attendance, { status: 200 })
    } catch (error: unknown) {
        console.error("Error upserting attendance:", error)
        return internalServerError("Failed to save attendance")
    }
}

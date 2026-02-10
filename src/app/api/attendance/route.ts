import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

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
    } catch (error: any) {
        console.error("Error fetching attendance:", error)
        return NextResponse.json({ message: "Failed to fetch attendance" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()

        if (!body.guardId || !body.date || !body.status) {
            return NextResponse.json(
                { message: "guardId, date and status are required" },
                { status: 400 }
            )
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
    } catch (error: any) {
        console.error("Error upserting attendance:", error)
        return NextResponse.json({ message: "Failed to save attendance" }, { status: 500 })
    }
}

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
        const cnic = searchParams.get("cnic")?.trim()

        const guards = await prisma.guard.findMany({
            where: {
                status: "BLACKLISTED",
                ...(cnic ? { cnic: { contains: cnic, mode: "insensitive" } } : {}),
            },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                name: true,
                cnic: true,
                updatedAt: true,
            },
            take: 200,
        })

        return NextResponse.json(guards)
    } catch (error: any) {
        console.error("Error fetching blacklisted guards:", error)
        return NextResponse.json({ message: "Failed to fetch blacklisted guards" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        if (!body.guardId) {
            return NextResponse.json({ message: "guardId is required" }, { status: 400 })
        }

        const guard = await prisma.guard.update({
            where: { id: body.guardId },
            data: { status: "BLACKLISTED" },
            select: { id: true, name: true, cnic: true, status: true },
        })

        return NextResponse.json(guard, { status: 200 })
    } catch (error: any) {
        console.error("Error blacklisting guard:", error)
        return NextResponse.json({ message: "Failed to blacklist guard" }, { status: 500 })
    }
}

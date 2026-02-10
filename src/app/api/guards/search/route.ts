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
        const q = searchParams.get("q")?.trim()
        const status = searchParams.get("status")
        const education = searchParams.get("education")
        const regionId = searchParams.get("regionId")

        const guards = await prisma.guard.findMany({
            where: {
                ...(status ? { status } : {}),
                ...(education ? { education } : {}),
                ...(regionId ? { regionId } : {}),
                ...(q
                    ? {
                        OR: [
                            { name: { contains: q, mode: "insensitive" } },
                            { parwestId: { contains: q, mode: "insensitive" } },
                            { cnic: { contains: q, mode: "insensitive" } },
                            { phone: { contains: q, mode: "insensitive" } },
                        ],
                    }
                    : {}),
            },
            orderBy: { name: "asc" },
            include: {
                region: true,
                regionalOffice: true,
            },
            take: 200,
        })

        return NextResponse.json(guards)
    } catch (error: any) {
        console.error("Error searching guards:", error)
        return NextResponse.json({ message: "Failed to search guards" }, { status: 500 })
    }
}

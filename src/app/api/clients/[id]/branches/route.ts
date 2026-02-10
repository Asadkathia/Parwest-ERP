import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params

        const branches = await prisma.branch.findMany({
            where: {
                clientId: id,
            },
            orderBy: { name: "asc" },
        })

        return NextResponse.json(branches)
    } catch (error: any) {
        console.error("Error fetching branches:", error)
        return NextResponse.json(
            { message: "Failed to fetch branches" },
            { status: 500 }
        )
    }
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { unauthorized } from "@/lib/api/response"

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session) return unauthorized()

    const { id } = await params

    const assignment = await prisma.guardSupervisorAssignment.findFirst({
        where: { guardId: id, status: "ACTIVE" },
        include: { supervisor: { select: { name: true, email: true } } },
    }).catch(() => null)

    return NextResponse.json({
        supervisorName: assignment?.supervisor?.name ?? null,
        supervisorEmail: assignment?.supervisor?.email ?? null,
    })
}

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

    // 1. Check direct GuardSupervisorAssignment first
    const directAssignment = await prisma.guardSupervisorAssignment.findFirst({
        where: { guardId: id, status: "ACTIVE" },
        orderBy: { assignedAt: "desc" },
        include: { supervisor: { select: { id: true, name: true, email: true } } },
    }).catch(() => null)

    if (directAssignment?.supervisor) {
        return NextResponse.json({
            supervisorName: directAssignment.supervisor.name,
            supervisorEmail: directAssignment.supervisor.email,
            source: "direct",
        })
    }

    // 2. Fall back: find supervisor through active deployment → ClientSupervisorAssignment
    const deployment = await prisma.deployment.findFirst({
        where: { guardId: id, status: "ACTIVE" },
        select: { clientId: true, branchId: true },
        orderBy: { deploymentDate: "desc" },
    }).catch(() => null)

    if (deployment?.clientId) {
        const clientSupervisor = await prisma.clientSupervisorAssignment.findFirst({
            where: {
                clientId: deployment.clientId,
                branchId: deployment.branchId ?? null,
                status: "ACTIVE",
            },
            orderBy: { createdAt: "desc" },
            include: { supervisor: { select: { id: true, name: true, email: true } } },
        }).catch(() => null)

        if (clientSupervisor?.supervisor) {
            return NextResponse.json({
                supervisorName: clientSupervisor.supervisor.name,
                supervisorEmail: clientSupervisor.supervisor.email,
                source: "deployment",
            })
        }
    }

    return NextResponse.json({
        supervisorName: null,
        supervisorEmail: null,
        source: null,
    })
}

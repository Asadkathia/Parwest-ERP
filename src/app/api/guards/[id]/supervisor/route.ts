import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "VIEW")) return forbidden("Access denied.")

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

// PATCH /api/guards/[id]/supervisor
// Assign or change the supervisor of a guard
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "UPDATE")) return forbidden("Access denied.")

        const { id: guardId } = await params
        const body = await request.json()
        const supervisorId = body?.supervisorId ? String(body.supervisorId).trim() : null

        if (!supervisorId) return badRequest("supervisorId is required")

        const [guard, supervisor] = await Promise.all([
            prisma.guard.findUnique({ where: { id: guardId }, select: { id: true, name: true } }),
            prisma.user.findUnique({ where: { id: supervisorId }, select: { id: true, name: true, email: true } }),
        ])
        if (!guard) return notFound("Guard not found")
        if (!supervisor) return notFound("Supervisor user not found")

        // End all active assignments and create new one atomically
        const assignment = await prisma.$transaction(async (tx) => {
            await tx.guardSupervisorAssignment.updateMany({
                where: { guardId, status: "ACTIVE" },
                data: { status: "ENDED", endedAt: new Date() },
            })
            return tx.guardSupervisorAssignment.create({
                data: {
                    guardId,
                    supervisorId,
                    status: "ACTIVE",
                    assignedAt: new Date(),
                },
            })
        })

        // Audit log (non-critical)
        const changedByName = (session.user as { name?: string })?.name ?? (session.user as { email?: string })?.email ?? null
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                event: "GUARD_SUPERVISOR_CHANGED",
                module: "GUARDS",
                description: `Guard ${guard.name} supervisor changed to ${supervisor.name ?? supervisor.email}${body?.notes ? `. Notes: ${body.notes}` : ""}. Changed by: ${changedByName}`,
            },
        }).catch(() => { /* non-critical */ })

        return NextResponse.json({ success: true, assignment, supervisorName: supervisor.name, supervisorEmail: supervisor.email })
    } catch (error) {
        console.error("PATCH /api/guards/[id]/supervisor:", error)
        return internalServerError("Failed to update supervisor")
    }
}

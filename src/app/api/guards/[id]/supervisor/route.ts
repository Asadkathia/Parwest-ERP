import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, forbidden, internalServerError, notFound, ok, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { requireGuardInScope } from "@/lib/guards/access"
import { deriveManagerScope, buildManagerScopeWhere } from "@/lib/access/scope"
import { assignGuardSupervisor } from "@/lib/guards/supervisorAssignment"

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
        return ok({
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
            return ok({
                supervisorName: clientSupervisor.supervisor.name,
                supervisorEmail: clientSupervisor.supervisor.email,
                source: "deployment",
            })
        }
    }

    return ok({
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

        const denied = await requireGuardInScope(session, guardId)
        if (denied) return denied

        const body = await request.json()
        const supervisorId = body?.supervisorId ? String(body.supervisorId).trim() : null

        if (!supervisorId) return badRequest("supervisorId is required")

        const guard = await prisma.guard.findUnique({ where: { id: guardId }, select: { id: true, name: true } })
        if (!guard) return notFound("Guard not found")

        // The chosen supervisor must be an ACTIVE user with the Supervisor role,
        // restricted to the actor's region/office (mirrors the import's
        // `scopedSupervisorWhere` + GET /api/users/supervisors) so a regional
        // admin cannot assign a supervisor from outside their scope. Resolve via
        // a scoped `findFirst` rather than a bare id lookup: an out-of-scope or
        // non-Supervisor id simply yields no match.
        const scope = deriveManagerScope(session)
        const supervisor = await prisma.user.findFirst({
            where: {
                id: supervisorId,
                status: "ACTIVE",
                role: { name: "Supervisor" },
                ...buildManagerScopeWhere(scope, { regionId: "regionId", regionalOfficeId: "regionalOfficeId" }),
            },
            select: { id: true, name: true, email: true },
        })
        if (!supervisor) {
            return badRequest("Supervisor must be an active Supervisor-role user within your scope.")
        }

        // End all active assignments and create new one atomically via the
        // GuardSupervisorAssignment SoT (canonical terminal status "ENDED",
        // prior-ACTIVE dedup, and supervisor-existence validation).
        const assignment = await prisma.$transaction(async (tx) => {
            return assignGuardSupervisor(tx, { guardId, supervisorId })
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

        return ok({ assignment, supervisorName: supervisor.name, supervisorEmail: supervisor.email })
    } catch (error) {
        if (error instanceof Error && error.message.startsWith("Supervisor user not found")) {
            return badRequest("Supervisor user does not exist.")
        }
        console.error("PATCH /api/guards/[id]/supervisor:", error)
        return internalServerError("Failed to update supervisor")
    }
}

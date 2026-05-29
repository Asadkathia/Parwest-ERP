import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { checkClientScope } from "@/lib/clients/access"

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasAction(session, "CLIENTS", "VIEW")) return forbidden("Access denied.")
        const { id: clientId } = await params

        const scope = await checkClientScope(clientId, session)
        if (scope === "not_found") return notFound("Client not found.")
        if (scope === "forbidden") return forbidden("Access denied.")

        // Collect this client's branch ids so branch-tagged audit rows surface
        // on the client profile too.
        const branches = await prisma.branch.findMany({
            where: { clientId },
            select: { id: true },
        })
        const branchIds = branches.map((b) => b.id)

        // Three-way OR:
        //  (a) explicitly tagged Client rows,
        //  (b) explicitly tagged Branch rows for this client's branches,
        //  (c) legacy fallback — un-tagged CLIENTS rows whose description mentions
        //      the clientId (substring match). New writers tag targetEntity*, so
        //      this is only needed for pre-deploy rows. Time-box it to BEFORE the
        //      tagging cutover so it doesn't permanently full-scan new rows.
        const LEGACY_AUDIT_CUTOVER = new Date("2026-05-29T00:00:00.000Z")
        const orClauses: Array<Record<string, unknown>> = [
            { targetEntityType: "Client", targetEntityId: clientId },
            { module: "CLIENTS", description: { contains: clientId }, createdAt: { lt: LEGACY_AUDIT_CUTOVER } },
        ]
        if (branchIds.length > 0) {
            orClauses.push({ targetEntityType: "Branch", targetEntityId: { in: branchIds } })
        }

        const logs = await prisma.auditLog.findMany({
            where: { OR: orClauses },
            orderBy: { createdAt: "desc" },
            take: 100,
            include: { user: { select: { name: true, email: true } } },
        })

        const result = logs.map((log) => ({
            id: log.id,
            event: log.event,
            module: log.module,
            description: log.description,
            createdAt: log.createdAt,
            userName: log.user?.name || log.user?.email || "System",
        }))

        return NextResponse.json(result)
    } catch (error) {
        console.error("Error fetching client audit history:", error)
        return internalServerError("Failed to fetch audit history")
    }
}

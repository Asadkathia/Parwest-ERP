import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { getPrismaCode, isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, forbidden, internalServerError, ok, serviceUnavailable, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { assignSupervisor } from "@/lib/clients/supervisorAssignment"
import { clientInScope, clientScopeWhere } from "@/lib/clients/access"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "USERS", "VIEW")) return forbidden("Access denied.")
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get("clientId") || undefined
    const branchId = searchParams.get("branchId") || undefined
    const supervisorId = searchParams.get("supervisorId") || undefined
    const managerScope = deriveManagerScope(session)

    if (managerScope && clientId && !(await clientInScope(clientId, managerScope))) {
      return forbidden("Forbidden: client is outside your scope.")
    }

    if (managerScope && supervisorId) {
      const supervisor = await prisma.user.findUnique({
        where: { id: supervisorId },
        select: { id: true, regionId: true, regionalOfficeId: true },
      })
      if (supervisor && managerScopeDenied(managerScope, { regionId: supervisor.regionId, regionalOfficeId: supervisor.regionalOfficeId })) {
        return forbidden("Forbidden: supervisor is outside your scope.")
      }
    }

    const where: Prisma.ClientSupervisorAssignmentWhereInput = {}
    if (clientId) where.clientId = clientId
    if (branchId) where.branchId = branchId
    if (supervisorId) where.supervisorId = supervisorId
    if (managerScope) {
      const clientWhere = clientScopeWhere(managerScope)
      if (Object.keys(clientWhere).length > 0) {
        where.client = clientWhere
      }
    }
    if (managerScope?.regionalOfficeIds.length) {
      where.supervisor = { regionalOfficeId: { in: managerScope.regionalOfficeIds } }
    }

    const rows = await prisma.clientSupervisorAssignment.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        supervisor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    })
    return ok(rows)
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) {
      return serviceUnavailable("Schema not migrated for client/supervisor assignments yet.")
    }
    console.error("Error fetching client/supervisor relationships:", error)
    return internalServerError("Failed to fetch relationships")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "USERS", "CREATE")) return forbidden("Access denied.")
    const body = await request.json()
    const clientId = String(body?.clientId || "").trim()
    const branchId = body?.branchId ? String(body.branchId).trim() : null
    const supervisorId = String(body?.supervisorId || "").trim()
    const effectiveDate = body?.effectiveDate ? new Date(String(body.effectiveDate)) : new Date()
    const notes = body?.notes ? String(body.notes) : null
    const managerScope = deriveManagerScope(session)

    if (!clientId || !supervisorId) {
      return badRequest("clientId and supervisorId are required.")
    }

    if (managerScope) {
      const supervisor = await prisma.user.findUnique({
        where: { id: supervisorId },
        select: { id: true, regionId: true, regionalOfficeId: true },
      })
      if (!(await clientInScope(clientId, managerScope))) {
        return forbidden("Forbidden: client is outside your scope.")
      }
      if (supervisor && managerScopeDenied(managerScope, { regionId: supervisor.regionId, regionalOfficeId: supervisor.regionalOfficeId })) {
        return forbidden("Forbidden: supervisor is outside your scope.")
      }
    }

    const actorId = session.user?.id || null

    // Route through the ClientSupervisorAssignment SoT so supervisor-existence
    // is validated and any prior ACTIVE row for the same (client, branch)
    // scope is deactivated atomically. The SoT creates the new ACTIVE row
    // with just (clientId, branchId, supervisorId); we then patch the
    // optional effectiveDate/notes fields in the same transaction.
    const created = await prisma.$transaction(async (tx) => {
      await assignSupervisor(tx, { clientId, branchId, supervisorId })

      const newActive = await tx.clientSupervisorAssignment.findFirst({
        where: { clientId, branchId: branchId ?? null, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      })
      if (!newActive) {
        throw new Error("Failed to locate just-created assignment row.")
      }

      if (effectiveDate || notes !== null) {
        await tx.clientSupervisorAssignment.update({
          where: { id: newActive.id },
          data: { effectiveDate, notes },
        })
      }

      return tx.clientSupervisorAssignment.findUnique({
        where: { id: newActive.id },
        include: {
          client: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          supervisor: { select: { id: true, name: true } },
        },
      })
    })

    await safeAuditLog({
      userId: actorId,
      event: "CLIENT_SUPERVISOR_ASSIGNED",
      module: "USERS",
      description: `Assigned supervisor ${supervisorId} to client ${clientId}${branchId ? ` branch ${branchId}` : ""} (relationship ${created?.id ?? "?"})`,
    })

    return ok(created, 201)
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) {
      return serviceUnavailable("Schema not migrated for client/supervisor assignments yet.")
    }
    if (error instanceof Error && error.message.startsWith("Supervisor user not found")) {
      return badRequest("Supervisor user does not exist.")
    }
    if (getPrismaCode(error) === "P2003") {
      return badRequest("Invalid client/branch/supervisor reference.")
    }
    console.error("Error creating client/supervisor relationship:", error)
    return internalServerError("Failed to create relationship")
  }
}

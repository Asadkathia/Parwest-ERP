import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { prisma } from "@/lib/db"
import { getPrismaCode, isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { forbidden, internalServerError, notFound, ok, serviceUnavailable, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { clientInScope } from "@/lib/clients/access"

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<unknown> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "USERS", "DELETE")) return forbidden("Access denied.")
    const { id } = (await context.params) as { id: string }
    const managerScope = deriveManagerScope(session)

    const actorId = session.user?.id || null
    const existing = await prisma.clientSupervisorAssignment.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        branchId: true,
        supervisorId: true,
        supervisor: { select: { regionId: true, regionalOfficeId: true } },
      },
    })
    if (!existing) throw new Error("REL_NOT_FOUND")
    if (
      managerScope &&
      (!(await clientInScope(existing.clientId, managerScope)) ||
        managerScopeDenied(managerScope, {
          regionId: existing.supervisor?.regionId || null,
          regionalOfficeId: existing.supervisor?.regionalOfficeId || null,
        }))
    ) {
      throw new Error("SCOPE_FORBIDDEN")
    }

    await prisma.clientSupervisorAssignment.delete({ where: { id } })
    await safeAuditLog({
      userId: actorId,
      event: "CLIENT_SUPERVISOR_UNASSIGNED",
      module: "USERS",
      description: `Removed client/supervisor relationship ${id} (client ${existing.clientId}, supervisor ${existing.supervisorId}${existing.branchId ? `, branch ${existing.branchId}` : ""})`,
    })

    return ok({ deleted: true })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "REL_NOT_FOUND") return notFound("Relationship not found.")
    if (error instanceof Error && error.message === "SCOPE_FORBIDDEN") return forbidden("Forbidden: relationship is outside your scope.")
    if (isPrismaMissingSchemaError(error)) {
      return serviceUnavailable("Schema not migrated for client/supervisor assignments yet.")
    }
    if (getPrismaCode(error) === "P2025") return notFound("Relationship not found.")
    console.error("Error deleting client/supervisor relationship:", error)
    return internalServerError("Failed to delete relationship")
  }
}

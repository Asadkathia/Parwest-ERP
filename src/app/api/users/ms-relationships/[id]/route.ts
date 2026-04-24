import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { getPrismaCode, isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { forbidden, internalServerError, notFound, serviceUnavailable, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"

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

    if (isRuntimeMockEnabled()) return NextResponse.json({ success: true })

    const actorId = session.user?.id || null
    const existing = await prisma.managerSupervisorAssignment.findUnique({
      where: { id },
      select: {
        id: true,
        managerId: true,
        supervisorId: true,
        regionalOfficeId: true,
        manager: { select: { regionId: true, regionalOfficeId: true } },
        supervisor: { select: { regionId: true, regionalOfficeId: true } },
      },
    })
    if (!existing) throw new Error("REL_NOT_FOUND")
    if (
      managerScope &&
      (managerScopeDenied(managerScope, { regionalOfficeId: existing.regionalOfficeId }) ||
        managerScopeDenied(managerScope, {
          regionId: existing.manager?.regionId || null,
          regionalOfficeId: existing.manager?.regionalOfficeId || null,
        }) ||
        managerScopeDenied(managerScope, {
          regionId: existing.supervisor?.regionId || null,
          regionalOfficeId: existing.supervisor?.regionalOfficeId || null,
        }))
    ) {
      throw new Error("SCOPE_FORBIDDEN")
    }

    await prisma.managerSupervisorAssignment.delete({ where: { id } })
    await safeAuditLog({
      userId: actorId,
      event: "MANAGER_SUPERVISOR_UNASSIGNED",
      module: "USERS",
      description: `Removed manager/supervisor relationship ${id} (manager ${existing.managerId}, supervisor ${existing.supervisorId})`,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "REL_NOT_FOUND") return notFound("Relationship not found.")
    if (error instanceof Error && error.message === "SCOPE_FORBIDDEN") return forbidden("Forbidden: relationship is outside your scope.")
    if (isPrismaMissingSchemaError(error)) {
      return serviceUnavailable("Schema not migrated for manager/supervisor assignments yet.")
    }
    if (getPrismaCode(error) === "P2025") return notFound("Relationship not found.")
    console.error("Error deleting manager/supervisor relationship:", error)
    return internalServerError("Failed to delete relationship")
  }
}

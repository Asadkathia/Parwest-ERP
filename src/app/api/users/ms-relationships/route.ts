import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { getPrismaCode, isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, forbidden, internalServerError, ok, serviceUnavailable, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "USERS", "VIEW")) return forbidden("Access denied.")
    const { searchParams } = new URL(request.url)
    const managerId = searchParams.get("managerId") || undefined
    const supervisorId = searchParams.get("supervisorId") || undefined
    const managerScope = deriveManagerScope(session)

    if (managerScope && managerId) {
      const manager = await prisma.user.findUnique({
        where: { id: managerId },
        select: { id: true, regionId: true, regionalOfficeId: true },
      })
      if (manager && managerScopeDenied(managerScope, { regionId: manager.regionId, regionalOfficeId: manager.regionalOfficeId })) {
        return forbidden("Forbidden: manager is outside your scope.")
      }
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

    const where: Prisma.ManagerSupervisorAssignmentWhereInput = {}
    if (managerId) where.managerId = managerId
    if (supervisorId) where.supervisorId = supervisorId
    if (managerScope?.regionId) {
      where.manager = { regionId: managerScope.regionId }
    }
    if (managerScope?.regionalOfficeIds.length) {
      where.supervisor = { regionalOfficeId: { in: managerScope.regionalOfficeIds } }
    }

    const rows = await prisma.managerSupervisorAssignment.findMany({
      where,
      include: {
        manager: { select: { id: true, name: true } },
        supervisor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    })
    return ok(rows)
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) {
      return serviceUnavailable("Schema not migrated for manager/supervisor assignments yet.")
    }
    console.error("Error fetching manager/supervisor relationships:", error)
    return internalServerError("Failed to fetch relationships")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "USERS", "CREATE")) return forbidden("Access denied.")
    const body = await request.json()
    const managerId = String(body?.managerId || "").trim()
    const supervisorId = String(body?.supervisorId || "").trim()
    const notes = body?.notes ? String(body.notes) : null
    const regionalOfficeId = body?.regionalOfficeId ? String(body.regionalOfficeId).trim() : null
    const managerScope = deriveManagerScope(session)

    if (!managerId || !supervisorId) {
      return badRequest("managerId and supervisorId are required.")
    }

    if (managerScope && managerScopeDenied(managerScope, { regionalOfficeId })) {
      return forbidden("Forbidden: relationship office is outside your scope.")
    }

    if (managerScope) {
      const [manager, supervisor] = await Promise.all([
        prisma.user.findUnique({
          where: { id: managerId },
          select: { id: true, regionId: true, regionalOfficeId: true },
        }),
        prisma.user.findUnique({
          where: { id: supervisorId },
          select: { id: true, regionId: true, regionalOfficeId: true },
        }),
      ])

      if (manager && managerScopeDenied(managerScope, { regionId: manager.regionId, regionalOfficeId: manager.regionalOfficeId })) {
        return forbidden("Forbidden: manager is outside your scope.")
      }
      if (supervisor && managerScopeDenied(managerScope, { regionId: supervisor.regionId, regionalOfficeId: supervisor.regionalOfficeId })) {
        return forbidden("Forbidden: supervisor is outside your scope.")
      }
    }

    const actorId = session.user?.id || null
    const created = await prisma.managerSupervisorAssignment.upsert({
      where: { managerId_supervisorId: { managerId, supervisorId } },
      create: {
        managerId,
        supervisorId,
        regionalOfficeId,
        notes,
        status: "ACTIVE",
      },
      update: {
        regionalOfficeId,
        notes,
        status: "ACTIVE",
      },
      include: {
        manager: { select: { id: true, name: true } },
        supervisor: { select: { id: true, name: true } },
      },
    })

    await safeAuditLog({
      userId: actorId,
      event: "MANAGER_SUPERVISOR_ASSIGNED",
      module: "USERS",
      description: `Assigned supervisor ${supervisorId} to manager ${managerId} (relationship ${created.id})`,
    })

    return ok(created, 201)
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) {
      return serviceUnavailable("Schema not migrated for manager/supervisor assignments yet.")
    }
    if (getPrismaCode(error) === "P2003") {
      return badRequest("Invalid manager/supervisor reference.")
    }
    console.error("Error creating manager/supervisor relationship:", error)
    return internalServerError("Failed to create relationship")
  }
}

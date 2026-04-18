import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { getPrismaCode, isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, forbidden, internalServerError, serviceUnavailable, unauthorized } from "@/lib/api/response"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"

const MOCK_ROWS = [
  {
    id: "mock-ms-1",
    manager: { id: "mock-user-2", name: "Muhammad Nazir" },
    supervisor: { id: "mock-user-3", name: "Muhammad Aslam" },
    effectiveDate: "2026-02-01T00:00:00.000Z",
    status: "ACTIVE",
    notes: null,
  },
]

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const { searchParams } = new URL(request.url)
    const managerId = searchParams.get("managerId") || undefined
    const supervisorId = searchParams.get("supervisorId") || undefined
    const managerScope = deriveManagerScope(session)

    if (isRuntimeMockEnabled()) {
      const rows = MOCK_ROWS.filter((row) => {
        if (managerId && row.manager.id !== managerId) return false
        if (supervisorId && row.supervisor.id !== supervisorId) return false
        return true
      })
      return NextResponse.json(rows)
    }

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
    return NextResponse.json(rows)
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
    const body = await request.json()
    const managerId = String(body?.managerId || "").trim()
    const supervisorId = String(body?.supervisorId || "").trim()
    const effectiveDate = body?.effectiveDate ? new Date(String(body.effectiveDate)) : new Date()
    const notes = body?.notes ? String(body.notes) : null
    const regionalOfficeId = body?.regionalOfficeId ? String(body.regionalOfficeId).trim() : null
    const managerScope = deriveManagerScope(session)

    if (!managerId || !supervisorId) {
      return badRequest("managerId and supervisorId are required.")
    }

    if (isRuntimeMockEnabled()) {
      return NextResponse.json(
        {
          id: `mock-ms-${Date.now()}`,
          manager: { id: managerId, name: "Manager" },
          supervisor: { id: supervisorId, name: "Supervisor" },
          effectiveDate: effectiveDate.toISOString(),
          status: "ACTIVE",
          notes,
        },
        { status: 201 }
      )
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
    const created = await prisma.managerSupervisorAssignment.create({
      data: {
        managerId,
        supervisorId,
        regionalOfficeId,
        effectiveDate,
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

    return NextResponse.json(created, { status: 201 })
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

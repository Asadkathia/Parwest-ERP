import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { getPrismaCode, isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, forbidden, internalServerError, serviceUnavailable, unauthorized } from "@/lib/api/response"

const MOCK_ROWS = [
  {
    id: "mock-cs-1",
    client: { id: "mock-client-1", name: "National Bank of Pakistan" },
    branch: { id: "mock-branch-1", name: "NBP Head Office" },
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
    const clientId = searchParams.get("clientId") || undefined
    const branchId = searchParams.get("branchId") || undefined
    const supervisorId = searchParams.get("supervisorId") || undefined
    const managerScope = deriveManagerScope(session)

    if (isRuntimeMockEnabled()) {
      const rows = MOCK_ROWS.filter((row) => {
        if (clientId && row.client.id !== clientId) return false
        if (branchId && row.branch?.id !== branchId) return false
        if (supervisorId && row.supervisor.id !== supervisorId) return false
        return true
      })
      return NextResponse.json(rows)
    }

    if (managerScope && clientId) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, regionId: true },
      })
      if (client && managerScopeDenied(managerScope, { regionId: client.regionId })) {
        return forbidden("Forbidden: client is outside your scope.")
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

    const where: Prisma.ClientSupervisorAssignmentWhereInput = {}
    if (clientId) where.clientId = clientId
    if (branchId) where.branchId = branchId
    if (supervisorId) where.supervisorId = supervisorId
    if (managerScope?.regionId) {
      where.client = { regionId: managerScope.regionId }
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
    return NextResponse.json(rows)
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

    if (isRuntimeMockEnabled()) {
      return NextResponse.json(
        {
          id: `mock-cs-${Date.now()}`,
          client: { id: clientId, name: "Client" },
          branch: branchId ? { id: branchId, name: "Branch" } : null,
          supervisor: { id: supervisorId, name: "Supervisor" },
          effectiveDate: effectiveDate.toISOString(),
          status: "ACTIVE",
          notes,
        },
        { status: 201 }
      )
    }

    if (managerScope) {
      const [client, supervisor] = await Promise.all([
        prisma.client.findUnique({
          where: { id: clientId },
          select: { id: true, regionId: true },
        }),
        prisma.user.findUnique({
          where: { id: supervisorId },
          select: { id: true, regionId: true, regionalOfficeId: true },
        }),
      ])
      if (client && managerScopeDenied(managerScope, { regionId: client.regionId })) {
        return forbidden("Forbidden: client is outside your scope.")
      }
      if (supervisor && managerScopeDenied(managerScope, { regionId: supervisor.regionId, regionalOfficeId: supervisor.regionalOfficeId })) {
        return forbidden("Forbidden: supervisor is outside your scope.")
      }
    }

    const actorId = session.user?.id || null
    const created = await prisma.$transaction(async (tx) => {
      const assignment = await tx.clientSupervisorAssignment.create({
        data: {
          clientId,
          branchId,
          supervisorId,
          effectiveDate,
          notes,
          status: "ACTIVE",
        },
        include: {
          client: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          supervisor: { select: { id: true, name: true } },
        },
      })

      await tx.auditLog.create({
        data: {
          userId: actorId,
          event: "CLIENT_SUPERVISOR_ASSIGNED",
          module: "USERS",
          description: `Assigned supervisor ${supervisorId} to client ${clientId}${branchId ? ` branch ${branchId}` : ""} (relationship ${assignment.id})`,
        },
      })

      return assignment
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) {
      return serviceUnavailable("Schema not migrated for client/supervisor assignments yet.")
    }
    if (getPrismaCode(error) === "P2003") {
      return badRequest("Invalid client/branch/supervisor reference.")
    }
    console.error("Error creating client/supervisor relationship:", error)
    return internalServerError("Failed to create relationship")
  }
}

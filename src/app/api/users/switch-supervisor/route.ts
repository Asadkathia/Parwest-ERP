import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, forbidden, internalServerError, serviceUnavailable, unauthorized } from "@/lib/api/response"

type PreviewRow = {
  id: string
  guardId: string
  parwestId: string
  guardName: string
  fromSupervisorId: string
  toSupervisorId: string
  status: string
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const { searchParams } = new URL(request.url)
    const fromSupervisorId = String(searchParams.get("fromSupervisorId") || "").trim()
    const toSupervisorId = String(searchParams.get("toSupervisorId") || "").trim()
    const managerScope = deriveManagerScope(session)

    if (!fromSupervisorId || !toSupervisorId) {
      return badRequest("fromSupervisorId and toSupervisorId are required.")
    }

    if (isRuntimeMockEnabled()) {
      const rows: PreviewRow[] = [
        {
          id: "mock-switch-1",
          guardId: "mock-guard-1",
          parwestId: "PW-00001",
          guardName: "Test Guard One",
          fromSupervisorId,
          toSupervisorId,
          status: "PENDING",
        },
        {
          id: "mock-switch-2",
          guardId: "mock-guard-2",
          parwestId: "PW-00002",
          guardName: "Test Guard Two",
          fromSupervisorId,
          toSupervisorId,
          status: "PENDING",
        },
      ]
      return NextResponse.json(rows)
    }

    if (managerScope) {
      const [fromSupervisor, toSupervisor] = await Promise.all([
        prisma.user.findUnique({
          where: { id: fromSupervisorId },
          select: { id: true, regionId: true, regionalOfficeId: true },
        }),
        prisma.user.findUnique({
          where: { id: toSupervisorId },
          select: { id: true, regionId: true, regionalOfficeId: true },
        }),
      ])
      if (fromSupervisor && managerScopeDenied(managerScope, { regionId: fromSupervisor.regionId, regionalOfficeId: fromSupervisor.regionalOfficeId })) {
        return forbidden("Forbidden: source supervisor is outside your scope.")
      }
      if (toSupervisor && managerScopeDenied(managerScope, { regionId: toSupervisor.regionId, regionalOfficeId: toSupervisor.regionalOfficeId })) {
        return forbidden("Forbidden: target supervisor is outside your scope.")
      }
    }

    const currentAssignments = await prisma.guardSupervisorAssignment.findMany({
      where: {
        supervisorId: fromSupervisorId,
        status: "ACTIVE",
      },
      include: {
        guard: { select: { id: true, name: true, parwestId: true, regionId: true, regionalOfficeId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    })

    if (managerScope) {
      const outOfScope = currentAssignments.some((assignment) =>
        managerScopeDenied(managerScope, {
          regionId: assignment.guard.regionId,
          regionalOfficeId: assignment.guard.regionalOfficeId,
        })
      )
      if (outOfScope) {
        return forbidden("Forbidden: one or more guard assignments are outside your scope.")
      }
    }

    const rows: PreviewRow[] = currentAssignments.map((assignment) => ({
      id: assignment.id,
      guardId: assignment.guardId,
      parwestId: assignment.guard.parwestId,
      guardName: assignment.guard.name,
      fromSupervisorId,
      toSupervisorId,
      status: "PENDING",
    }))

    return NextResponse.json(rows)
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) {
      return serviceUnavailable("Schema not migrated for supervisor switching yet.")
    }
    console.error("Error previewing supervisor switch:", error)
    return internalServerError("Failed to preview supervisor switch")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return unauthorized()
    const body = await request.json()
    const fromSupervisorId = String(body?.fromSupervisorId || "").trim()
    const toSupervisorId = String(body?.toSupervisorId || "").trim()
    const reason = body?.reason ? String(body.reason) : null
    const managerScope = deriveManagerScope(session)

    if (!fromSupervisorId || !toSupervisorId) {
      return badRequest("fromSupervisorId and toSupervisorId are required.")
    }

    if (fromSupervisorId === toSupervisorId) {
      return badRequest("From and to supervisors cannot be same.")
    }

    if (isRuntimeMockEnabled()) {
      return NextResponse.json({ switchedCount: 2, reason, switchedBy: session.user.id })
    }

    if (managerScope) {
      const [fromSupervisor, toSupervisor] = await Promise.all([
        prisma.user.findUnique({
          where: { id: fromSupervisorId },
          select: { id: true, regionId: true, regionalOfficeId: true },
        }),
        prisma.user.findUnique({
          where: { id: toSupervisorId },
          select: { id: true, regionId: true, regionalOfficeId: true },
        }),
      ])
      if (fromSupervisor && managerScopeDenied(managerScope, { regionId: fromSupervisor.regionId, regionalOfficeId: fromSupervisor.regionalOfficeId })) {
        return forbidden("Forbidden: source supervisor is outside your scope.")
      }
      if (toSupervisor && managerScopeDenied(managerScope, { regionId: toSupervisor.regionId, regionalOfficeId: toSupervisor.regionalOfficeId })) {
        return forbidden("Forbidden: target supervisor is outside your scope.")
      }
    }

    const activeAssignments = await prisma.guardSupervisorAssignment.findMany({
      where: { supervisorId: fromSupervisorId, status: "ACTIVE" },
      select: {
        id: true,
        guardId: true,
        guard: { select: { regionId: true, regionalOfficeId: true } },
      },
    })

    if (managerScope) {
      const outOfScope = activeAssignments.some((assignment) =>
        managerScopeDenied(managerScope, {
          regionId: assignment.guard.regionId,
          regionalOfficeId: assignment.guard.regionalOfficeId,
        })
      )
      if (outOfScope) {
        return forbidden("Forbidden: one or more guard assignments are outside your scope.")
      }
    }

    if (activeAssignments.length === 0) {
      return NextResponse.json({ switchedCount: 0, reason, switchedBy: session.user.id })
    }

    await prisma.$transaction(async (tx) => {
      await tx.guardSupervisorAssignment.updateMany({
        where: { id: { in: activeAssignments.map((item) => item.id) } },
        data: { status: "INACTIVE", endedAt: new Date() },
      })

      await tx.guardSupervisorAssignment.createMany({
        data: activeAssignments.map((item) => ({
          guardId: item.guardId,
          supervisorId: toSupervisorId,
          status: "ACTIVE",
          assignedAt: new Date(),
        })),
      })

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          event: "SUPERVISOR_SWITCH",
          module: "USERS",
          description: `Switched ${activeAssignments.length} guards from ${fromSupervisorId} to ${toSupervisorId}${reason ? ` (${reason})` : ""}`,
        },
      })
    })

    return NextResponse.json({ switchedCount: activeAssignments.length, reason, switchedBy: session.user.id })
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) {
      return serviceUnavailable("Schema not migrated for supervisor switching yet.")
    }
    if (typeof error === "object" && error !== null && "code" in error && String((error as { code?: unknown }).code) === "P2003") {
      return badRequest("Invalid supervisor reference.")
    }
    console.error("Error applying supervisor switch:", error)
    return internalServerError("Failed to switch supervisor")
  }
}

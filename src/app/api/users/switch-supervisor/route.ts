import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"

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
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const fromSupervisorId = String(searchParams.get("fromSupervisorId") || "").trim()
    const toSupervisorId = String(searchParams.get("toSupervisorId") || "").trim()

    if (!fromSupervisorId || !toSupervisorId) {
      return NextResponse.json({ message: "fromSupervisorId and toSupervisorId are required." }, { status: 400 })
    }

    if (isMockEnabled()) {
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

    const currentAssignments = await prisma.guardSupervisorAssignment.findMany({
      where: {
        supervisorId: fromSupervisorId,
        status: "ACTIVE",
      },
      include: {
        guard: { select: { id: true, name: true, parwestId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    })

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
      return NextResponse.json({ message: "Schema not migrated for supervisor switching yet." }, { status: 503 })
    }
    console.error("Error previewing supervisor switch:", error)
    return NextResponse.json({ message: "Failed to preview supervisor switch" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const body = await request.json()
    const fromSupervisorId = String(body?.fromSupervisorId || "").trim()
    const toSupervisorId = String(body?.toSupervisorId || "").trim()
    const reason = body?.reason ? String(body.reason) : null

    if (!fromSupervisorId || !toSupervisorId) {
      return NextResponse.json({ message: "fromSupervisorId and toSupervisorId are required." }, { status: 400 })
    }

    if (fromSupervisorId === toSupervisorId) {
      return NextResponse.json({ message: "From and to supervisors cannot be same." }, { status: 400 })
    }

    if (isMockEnabled()) {
      return NextResponse.json({ switchedCount: 2, reason, switchedBy: session.user.id })
    }

    const activeAssignments = await prisma.guardSupervisorAssignment.findMany({
      where: { supervisorId: fromSupervisorId, status: "ACTIVE" },
      select: { id: true, guardId: true },
    })

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
  } catch (error: any) {
    if (isPrismaMissingSchemaError(error)) {
      return NextResponse.json({ message: "Schema not migrated for supervisor switching yet." }, { status: 503 })
    }
    if (String(error?.code) === "P2003") {
      return NextResponse.json({ message: "Invalid supervisor reference." }, { status: 400 })
    }
    console.error("Error applying supervisor switch:", error)
    return NextResponse.json({ message: "Failed to switch supervisor" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"

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
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const managerId = searchParams.get("managerId") || undefined
    const supervisorId = searchParams.get("supervisorId") || undefined

    if (isMockEnabled()) {
      const rows = MOCK_ROWS.filter((row) => {
        if (managerId && row.manager.id !== managerId) return false
        if (supervisorId && row.supervisor.id !== supervisorId) return false
        return true
      })
      return NextResponse.json(rows)
    }

    const where: any = {}
    if (managerId) where.managerId = managerId
    if (supervisorId) where.supervisorId = supervisorId

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
      return NextResponse.json({ message: "Schema not migrated for manager/supervisor assignments yet." }, { status: 503 })
    }
    console.error("Error fetching manager/supervisor relationships:", error)
    return NextResponse.json({ message: "Failed to fetch relationships" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const body = await request.json()
    const managerId = String(body?.managerId || "").trim()
    const supervisorId = String(body?.supervisorId || "").trim()
    const effectiveDate = body?.effectiveDate ? new Date(String(body.effectiveDate)) : new Date()
    const notes = body?.notes ? String(body.notes) : null

    if (!managerId || !supervisorId) {
      return NextResponse.json({ message: "managerId and supervisorId are required." }, { status: 400 })
    }

    if (isMockEnabled()) {
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

    const created = await prisma.managerSupervisorAssignment.create({
      data: {
        managerId,
        supervisorId,
        effectiveDate,
        notes,
        status: "ACTIVE",
      },
      include: {
        manager: { select: { id: true, name: true } },
        supervisor: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (isPrismaMissingSchemaError(error)) {
      return NextResponse.json({ message: "Schema not migrated for manager/supervisor assignments yet." }, { status: 503 })
    }
    if (String(error?.code) === "P2003") {
      return NextResponse.json({ message: "Invalid manager/supervisor reference." }, { status: 400 })
    }
    console.error("Error creating manager/supervisor relationship:", error)
    return NextResponse.json({ message: "Failed to create relationship" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"

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
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get("clientId") || undefined
    const branchId = searchParams.get("branchId") || undefined
    const supervisorId = searchParams.get("supervisorId") || undefined

    if (isMockEnabled()) {
      const rows = MOCK_ROWS.filter((row) => {
        if (clientId && row.client.id !== clientId) return false
        if (branchId && row.branch?.id !== branchId) return false
        if (supervisorId && row.supervisor.id !== supervisorId) return false
        return true
      })
      return NextResponse.json(rows)
    }

    const where: any = {}
    if (clientId) where.clientId = clientId
    if (branchId) where.branchId = branchId
    if (supervisorId) where.supervisorId = supervisorId

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
      return NextResponse.json({ message: "Schema not migrated for client/supervisor assignments yet." }, { status: 503 })
    }
    console.error("Error fetching client/supervisor relationships:", error)
    return NextResponse.json({ message: "Failed to fetch relationships" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const body = await request.json()
    const clientId = String(body?.clientId || "").trim()
    const branchId = body?.branchId ? String(body.branchId).trim() : null
    const supervisorId = String(body?.supervisorId || "").trim()
    const effectiveDate = body?.effectiveDate ? new Date(String(body.effectiveDate)) : new Date()
    const notes = body?.notes ? String(body.notes) : null

    if (!clientId || !supervisorId) {
      return NextResponse.json({ message: "clientId and supervisorId are required." }, { status: 400 })
    }

    if (isMockEnabled()) {
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

    const created = await prisma.clientSupervisorAssignment.create({
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
    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (isPrismaMissingSchemaError(error)) {
      return NextResponse.json({ message: "Schema not migrated for client/supervisor assignments yet." }, { status: 503 })
    }
    if (String(error?.code) === "P2003") {
      return NextResponse.json({ message: "Invalid client/branch/supervisor reference." }, { status: 400 })
    }
    console.error("Error creating client/supervisor relationship:", error)
    return NextResponse.json({ message: "Failed to create relationship" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"

const MOCK_AUDIT_LOGS = [
  {
    id: "mock-audit-1",
    event: "CREATED",
    module: "GUARDS",
    ipAddress: "127.0.0.1",
    description: "Created guard profile",
    createdAt: "2026-02-24T08:00:00.000Z",
    user: { id: "mock-user-1", name: "Admin User", email: "admin@parwestgroup.com" },
  },
  {
    id: "mock-audit-2",
    event: "UPDATED",
    module: "CLIENTS",
    ipAddress: "127.0.0.1",
    description: "Updated branch billing settings",
    createdAt: "2026-02-24T09:15:00.000Z",
    user: { id: "mock-user-2", name: "Muhammad Nazir", email: "nazir@parwestgroup.com" },
  },
]

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const moduleFilter = searchParams.get("module")?.trim()
    const eventFilter = searchParams.get("event")?.trim()
    const userId = searchParams.get("userId")?.trim()
    const search = searchParams.get("search")?.trim()
    const dateFromRaw = searchParams.get("dateFrom")
    const dateToRaw = searchParams.get("dateTo")

    if (isMockEnabled()) {
      let rows = [...MOCK_AUDIT_LOGS]
      if (moduleFilter) rows = rows.filter((row) => row.module === moduleFilter)
      if (eventFilter) rows = rows.filter((row) => row.event === eventFilter)
      if (userId) rows = rows.filter((row) => row.user?.id === userId)
      if (search) {
        const q = search.toLowerCase()
        rows = rows.filter((row) =>
          `${row.module} ${row.event} ${row.description || ""} ${row.user?.name || ""}`
            .toLowerCase()
            .includes(q)
        )
      }
      return NextResponse.json(rows)
    }

    const where: any = {}
    if (moduleFilter) where.module = moduleFilter
    if (eventFilter) where.event = eventFilter
    if (userId) where.userId = userId
    if (search) {
      where.OR = [
        { module: { contains: search, mode: "insensitive" } },
        { event: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
      ]
    }

    if (dateFromRaw || dateToRaw) {
      const createdAt: any = {}
      if (dateFromRaw) {
        const dateFrom = new Date(dateFromRaw)
        if (!Number.isNaN(dateFrom.getTime())) createdAt.gte = dateFrom
      }
      if (dateToRaw) {
        const dateTo = new Date(dateToRaw)
        if (!Number.isNaN(dateTo.getTime())) createdAt.lte = dateTo
      }
      if (Object.keys(createdAt).length > 0) where.createdAt = createdAt
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error("Error fetching audit logs:", error)
    return NextResponse.json({ message: "Failed to fetch audit logs" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const event = String(body?.event || "").trim()
    const module = String(body?.module || "").trim()
    const description = body?.description ? String(body.description) : null
    const ipAddress = body?.ipAddress ? String(body.ipAddress) : null

    if (!event || !module) {
      return NextResponse.json({ message: "event and module are required." }, { status: 400 })
    }

    if (isMockEnabled()) {
      return NextResponse.json(
        {
          id: `mock-audit-${Date.now()}`,
          event,
          module,
          description,
          ipAddress,
          createdAt: new Date().toISOString(),
          user: { id: session.user?.id, name: session.user?.name, email: session.user?.email },
        },
        { status: 201 }
      )
    }

    const created = await prisma.auditLog.create({
      data: {
        userId: session.user?.id || null,
        event,
        module,
        description,
        ipAddress,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("Error creating audit log:", error)
    return NextResponse.json({ message: "Failed to create audit log" }, { status: 500 })
  }
}

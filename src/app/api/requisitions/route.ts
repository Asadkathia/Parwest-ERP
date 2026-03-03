import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, internalServerError, serviceUnavailable, unauthorized } from "@/lib/api/response"

const MOCK_ROWS = [
  {
    id: "mock-req-1",
    title: "Uniform restock request",
    description: "Need 20 uniforms for Lahore office.",
    module: "INVENTORY",
    priority: "HIGH",
    status: "PENDING",
    requester: { id: "mock-user-2", name: "Muhammad Nazir" },
    approver: null,
    createdAt: "2026-02-24T10:30:00.000Z",
  },
]

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || undefined
    const moduleName = searchParams.get("module") || undefined
    const priority = searchParams.get("priority") || undefined
    const search = searchParams.get("search") || undefined

    if (isRuntimeMockEnabled()) {
      const rows = MOCK_ROWS.filter((row) => {
        if (status && row.status !== status) return false
        if (moduleName && row.module !== moduleName) return false
        if (priority && row.priority !== priority) return false
        if (search && !`${row.title} ${row.description || ""}`.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
      return NextResponse.json(rows)
    }

    const where: Prisma.RequisitionWhereInput = {}
    if (status) where.status = status
    if (moduleName) where.module = moduleName
    if (priority) where.priority = priority
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    const rows = await prisma.requisition.findMany({
      where,
      include: {
        requester: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    })
    return NextResponse.json(rows)
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) {
      return serviceUnavailable("Schema not migrated for requisitions yet.")
    }
    console.error("Error fetching requisitions:", error)
    return internalServerError("Failed to fetch requisitions")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return unauthorized()
    const body = await request.json()
    const title = String(body?.title || "").trim()
    const description = body?.description ? String(body.description) : null
    const moduleName = String(body?.module || "").trim()
    const priority = String(body?.priority || "NORMAL").trim()

    if (!title || !moduleName) {
      return badRequest("title and module are required.")
    }

    if (isRuntimeMockEnabled()) {
      return NextResponse.json(
        {
          id: `mock-req-${Date.now()}`,
          title,
          description,
          module: moduleName,
          priority,
          status: "PENDING",
          requester: { id: session.user.id, name: session.user.name || "Current User" },
          approver: null,
          createdAt: new Date().toISOString(),
        },
        { status: 201 }
      )
    }

    const created = await prisma.requisition.create({
      data: {
        title,
        description,
        module: moduleName,
        priority,
        status: "PENDING",
        requesterId: session.user.id,
      },
      include: {
        requester: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) {
      return serviceUnavailable("Schema not migrated for requisitions yet.")
    }
    if (String((error as { code?: string }).code) === "P2003") {
      return badRequest("Invalid requester reference.")
    }
    console.error("Error creating requisition:", error)
    return internalServerError("Failed to create requisition")
  }
}

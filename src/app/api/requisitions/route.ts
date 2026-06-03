import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { prisma } from "@/lib/db"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, forbidden, internalServerError, serviceUnavailable, unauthorized } from "@/lib/api/response"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "REQUISITIONS", "REQUISITIONS")) return forbidden()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || undefined
    const moduleName = searchParams.get("module") || undefined
    const priority = searchParams.get("priority") || undefined
    const search = searchParams.get("search") || undefined

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
    if (!hasAction(session, "REQUISITIONS", "REQUISITIONS")) return forbidden()
    const body = await request.json()
    const title = String(body?.title || "").trim()
    const description = body?.description ? String(body.description) : null
    const moduleName = String(body?.module || "").trim()
    const priority = String(body?.priority || "NORMAL").trim()

    if (!title || !moduleName) {
      return badRequest("title and module are required.")
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

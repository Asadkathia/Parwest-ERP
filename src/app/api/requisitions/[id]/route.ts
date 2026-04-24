import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, forbidden, internalServerError, notFound, serviceUnavailable, unauthorized } from "@/lib/api/response"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return unauthorized()
    if (!hasAction(session, "REQUISITIONS", "REQUISITIONS")) return forbidden()
    const { id } = await context.params

    if (isRuntimeMockEnabled()) {
      return NextResponse.json({ id, title: "Mock Requisition", status: "PENDING", module: "General" })
    }

    const req = await prisma.requisition.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
    })
    if (!req) return notFound("Requisition not found.")
    return NextResponse.json(req)
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) {
      return serviceUnavailable("Schema not migrated for requisitions yet.")
    }
    console.error("Error fetching requisition:", error)
    return internalServerError("Failed to fetch requisition")
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return unauthorized()
    if (!hasAction(session, "REQUISITIONS", "REQUISITIONS")) return forbidden()
    const { id } = await context.params
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.status != null) data.status = String(body.status)
    if (body.decisionNotes !== undefined) data.decisionNotes = body.decisionNotes ? String(body.decisionNotes) : null
    if (body.title != null) data.title = String(body.title)
    if (body.description !== undefined) data.description = body.description ? String(body.description) : null
    if (body.module != null) data.module = String(body.module)
    if (body.priority != null) data.priority = String(body.priority)

    if (body.status === "APPROVED" || body.status === "REJECTED") {
      data.approverId = session.user.id
      data.approvedAt = new Date()
    }

    if (Object.keys(data).length === 0) {
      return badRequest("No valid fields provided.")
    }

    if (isRuntimeMockEnabled()) {
      return NextResponse.json({ id, ...data })
    }

    const updated = await prisma.requisition.update({
      where: { id },
      data,
      include: {
        requester: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) {
      return serviceUnavailable("Schema not migrated for requisitions yet.")
    }
    if (String((error as { code?: string }).code) === "P2025") return notFound("Requisition not found.")
    console.error("Error updating requisition:", error)
    return internalServerError("Failed to update requisition")
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const { id } = await context.params

    if (isMockEnabled()) {
      return NextResponse.json({ id, title: "Mock Requisition", status: "PENDING", module: "General" })
    }

    const req = await prisma.requisition.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
    })
    if (!req) return NextResponse.json({ message: "Requisition not found." }, { status: 404 })
    return NextResponse.json(req)
  } catch (error: any) {
    if (isPrismaMissingSchemaError(error)) {
      return NextResponse.json({ message: "Schema not migrated for requisitions yet." }, { status: 503 })
    }
    console.error("Error fetching requisition:", error)
    return NextResponse.json({ message: "Failed to fetch requisition" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const { id } = await context.params
    const body = await request.json()
    const data: any = {}

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
      return NextResponse.json({ message: "No valid fields provided." }, { status: 400 })
    }

    if (isMockEnabled()) {
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
  } catch (error: any) {
    if (isPrismaMissingSchemaError(error)) {
      return NextResponse.json({ message: "Schema not migrated for requisitions yet." }, { status: 503 })
    }
    if (String(error?.code) === "P2025") return NextResponse.json({ message: "Requisition not found." }, { status: 404 })
    console.error("Error updating requisition:", error)
    return NextResponse.json({ message: "Failed to update requisition" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, internalServerError, notFound, serviceUnavailable, unauthorized } from "@/lib/api/response"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id } = await context.params

    const guard = await prisma.guard.findUnique({ where: { id }, select: { id: true } })
    if (!guard) return notFound("Guard not found.")

    const records = await prisma.guardPledgedDocumentRecord.findMany({
      where: { guardId: id },
      orderBy: { createdAt: "desc" },
      include: {
        returnCondition: { select: { id: true, name: true } },
        history: {
          orderBy: { performedAt: "desc" },
        },
      },
    })

    return NextResponse.json(records)
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for pledged document records yet.")
    console.error("Error fetching pledged document records:", error)
    return internalServerError("Failed to fetch pledged document records.")
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id } = await context.params

    const guard = await prisma.guard.findUnique({ where: { id }, select: { id: true } })
    if (!guard) return notFound("Guard not found.")

    const body = await request.json()
    const documentTypeName = String(body?.documentTypeName || "").trim()
    if (!documentTypeName) return badRequest("documentTypeName is required.")

    const attachmentData = body?.attachmentData ? String(body.attachmentData) : null
    const attachmentName = body?.attachmentName ? String(body.attachmentName) : null
    const notes = body?.notes ? String(body.notes) : null

    const typedSession = session as unknown as { user?: { name?: string; email?: string } }
    const performedBy = typedSession.user?.name ?? typedSession.user?.email ?? null

    const record = await prisma.guardPledgedDocumentRecord.create({
      data: {
        guardId: id,
        documentTypeName,
        receivedBy: performedBy,
        attachmentData,
        attachmentName,
        notes,
        status: "HELD",
      },
    })

    // Write audit history
    await prisma.guardPledgedDocumentHistory.create({
      data: {
        recordId: record.id,
        guardId: id,
        action: "CREATED",
        performedBy,
        details: JSON.stringify({ documentTypeName, notes }),
      },
    }).catch(() => { /* non-critical */ })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for pledged document records yet.")
    console.error("Error creating pledged document record:", error)
    return internalServerError("Failed to create pledged document record.")
  }
}
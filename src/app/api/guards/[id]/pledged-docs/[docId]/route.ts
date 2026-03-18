import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { internalServerError, notFound, serviceUnavailable, unauthorized } from "@/lib/api/response"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id, docId } = await context.params

    const existing = await prisma.guardPledgedDocumentRecord.findFirst({
      where: { id: docId, guardId: id },
    })
    if (!existing) return notFound("Pledged document record not found.")

    const body = await request.json()
    const typedSession = session as unknown as { user?: { name?: string; email?: string } }
    const returnedBy = typedSession.user?.name ?? typedSession.user?.email ?? null

    const updated = await prisma.guardPledgedDocumentRecord.update({
      where: { id: docId },
      data: {
        status: "RETURNED",
        returnedBy,
        returnedAt: new Date(),
        ...(body?.notes !== undefined ? { notes: body.notes ? String(body.notes) : null } : {}),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for pledged document records yet.")
    console.error("Error updating pledged document record:", error)
    return internalServerError("Failed to update pledged document record.")
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id, docId } = await context.params

    const existing = await prisma.guardPledgedDocumentRecord.findFirst({
      where: { id: docId, guardId: id },
    })
    if (!existing) return notFound("Pledged document record not found.")

    await prisma.guardPledgedDocumentRecord.delete({ where: { id: docId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for pledged document records yet.")
    console.error("Error deleting pledged document record:", error)
    return internalServerError("Failed to delete pledged document record.")
  }
}

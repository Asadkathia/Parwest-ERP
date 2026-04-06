import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, internalServerError, notFound, serviceUnavailable, unauthorized } from "@/lib/api/response"

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
    const performedBy = typedSession.user?.name ?? typedSession.user?.email ?? null

    // ── ACTION: REHOLD ────────────────────────────────────────────────────────
    // Re-takes custody of a temporarily-returned document
    if (body?.action === "REHOLD") {
      const updated = await prisma.guardPledgedDocumentRecord.update({
        where: { id: docId },
        data: {
          status: "HELD",
          returnType: null,
          returnedBy: null,
          returnedAt: null,
          returnConditionId: null,
          returnReason: null,
          expectedReturnDate: null,
        },
      })

      await (prisma.guardPledgedDocumentHistory as unknown as {
        create: (args: { data: Record<string, unknown> }) => Promise<unknown>
      }).create({
        data: {
          recordId: docId,
          guardId: id,
          action: "REHOLD",
          performedBy,
          details: JSON.stringify({ note: "Document re-taken into custody" }),
        },
      }).catch(() => { /* non-critical */ })

      return NextResponse.json(updated)
    }

    // ── ACTION: NEW_VERSION ───────────────────────────────────────────────────
    // Uploads a new version of the document; archives the previous file in history
    if (body?.action === "NEW_VERSION") {
      const attachmentData = body?.attachmentData ? String(body.attachmentData) : null
      const attachmentName = body?.attachmentName ? String(body.attachmentName) : null
      if (!attachmentData) return badRequest("attachmentData is required for NEW_VERSION.")

      // Archive the old file in history before replacing
      if (existing.attachmentData || existing.attachmentName) {
        await (prisma.guardPledgedDocumentHistory as unknown as {
          create: (args: { data: Record<string, unknown> }) => Promise<unknown>
        }).create({
          data: {
            recordId: docId,
            guardId: id,
            action: "VERSION_UPLOADED",
            performedBy,
            details: JSON.stringify({
              previousAttachmentName: existing.attachmentName,
              newAttachmentName: attachmentName,
              note: "Previous version archived",
            }),
            attachmentData: existing.attachmentData,
            attachmentName: existing.attachmentName,
          },
        }).catch(() => { /* non-critical */ })
      }

      const updated = await prisma.guardPledgedDocumentRecord.update({
        where: { id: docId },
        data: {
          attachmentData,
          attachmentName,
        },
      })

      return NextResponse.json(updated)
    }

    // ── DEFAULT ACTION: RETURN ────────────────────────────────────────────────
    const returnType = body?.returnType ? String(body.returnType) : null
    if (returnType && !["CLEARANCE", "TEMPORARY"].includes(returnType)) {
      return badRequest("returnType must be CLEARANCE or TEMPORARY.")
    }

    const returnConditionId = body?.returnConditionId ? String(body.returnConditionId) : null
    const returnReason = body?.returnReason ? String(body.returnReason).trim() : null
    const expectedReturnDate = body?.expectedReturnDate
      ? (() => { const d = new Date(body.expectedReturnDate); return Number.isNaN(d.getTime()) ? null : d })()
      : null

    if (returnType === "TEMPORARY" && !returnConditionId && !returnReason) {
      return badRequest("A condition or reason is required for temporary issuance.")
    }

    const updated = await prisma.guardPledgedDocumentRecord.update({
      where: { id: docId },
      data: {
        status: "RETURNED",
        returnedBy: performedBy,
        returnedAt: new Date(),
        returnType,
        returnConditionId,
        returnReason,
        expectedReturnDate,
        ...(body?.notes !== undefined ? { notes: body.notes ? String(body.notes) : null } : {}),
      },
    })

    await (prisma.guardPledgedDocumentHistory as unknown as {
      create: (args: { data: Record<string, unknown> }) => Promise<unknown>
    }).create({
      data: {
        recordId: docId,
        guardId: id,
        action: "RETURNED",
        performedBy,
        details: JSON.stringify({
          returnType,
          returnConditionId,
          returnReason,
          expectedReturnDate: expectedReturnDate?.toISOString() ?? null,
        }),
      },
    }).catch(() => { /* non-critical */ })

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

    const typedSession = session as unknown as { user?: { name?: string; email?: string } }
    const performedBy = typedSession.user?.name ?? typedSession.user?.email ?? null

    console.info(`[AUDIT] PledgedDoc DELETE: record=${docId} guard=${id} by=${performedBy} doc=${existing.documentTypeName}`)

    await prisma.guardPledgedDocumentRecord.delete({ where: { id: docId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for pledged document records yet.")
    console.error("Error deleting pledged document record:", error)
    return internalServerError("Failed to delete pledged document record.")
  }
}
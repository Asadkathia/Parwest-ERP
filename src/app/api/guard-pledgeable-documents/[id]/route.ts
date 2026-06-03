import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import {
  badRequest,
  conflict,
  forbidden,
  internalServerError,
  notFound,
  ok,
  serviceUnavailable,
  unauthorized,
} from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "SETTINGS", "UPDATE")) return forbidden()
    const { id } = await context.params
    const body = await request.json()
    const data: { name?: string; description?: string | null } = {}

    if (body.name !== undefined) {
      const name = String(body.name || "").trim()
      if (!name) return badRequest("Name is required.")
      data.name = name
    }
    if (body.description !== undefined) {
      data.description = body.description ? String(body.description) : null
    }
    if (Object.keys(data).length === 0) return badRequest("No fields provided.")

    const updated = await prisma.guardPledgeableDocument.update({
      where: { id },
      data,
    })
    return ok(updated)
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for guard pledgeable documents yet.")
    if (String((error as { code?: string }).code) === "P2025") return notFound("Document type not found.")
    if (String((error as { code?: string }).code) === "P2002") return conflict("Document type already exists.")
    console.error("Error updating guard pledgeable document:", error)
    return internalServerError("Failed to update document type.")
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "SETTINGS", "DELETE")) return forbidden()
    const { id } = await context.params

    await prisma.guardPledgeableDocument.delete({
      where: { id },
    })
    return ok({ id })
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for guard pledgeable documents yet.")
    if (String((error as { code?: string }).code) === "P2025") return notFound("Document type not found.")
    console.error("Error deleting guard pledgeable document:", error)
    return internalServerError("Failed to delete document type.")
  }
}

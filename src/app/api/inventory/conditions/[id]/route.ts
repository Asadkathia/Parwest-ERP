import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"
import { getPrismaCode, isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, notFound, serviceUnavailable, unauthorized } from "@/lib/api/response"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const { id } = await context.params
    const body = await request.json()
    const name = body?.name != null ? String(body.name).trim() : undefined
    const description = body?.description !== undefined ? (body.description ? String(body.description) : null) : undefined
    const data: { name?: string; description?: string | null } = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (Object.keys(data).length === 0) return badRequest("No fields provided.")

    if (isMockEnabled()) return NextResponse.json({ id, ...data })

    const updated = await prisma.inventoryCondition.update({
      where: { id },
      data,
    })
    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for inventory conditions yet.")
    if (getPrismaCode(error) === "P2025") return notFound("Condition not found.")
    if (getPrismaCode(error) === "P2002") return conflict("Condition already exists.")
    console.error("Error updating inventory condition:", error)
    return internalServerError("Failed to update condition.")
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const { id } = await context.params
    if (isMockEnabled()) return NextResponse.json({ success: true })

    await prisma.inventoryCondition.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for inventory conditions yet.")
    if (getPrismaCode(error) === "P2025") return notFound("Condition not found.")
    if (getPrismaCode(error) === "P2003") return conflict("Condition is in use by inventory items.")
    console.error("Error deleting inventory condition:", error)
    return internalServerError("Failed to delete condition.")
  }
}

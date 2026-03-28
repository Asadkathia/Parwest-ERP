import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, internalServerError, notFound, serviceUnavailable, unauthorized } from "@/lib/api/response"

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id } = await context.params
    const body = await request.json()
    const name = String(body?.name || "").trim()
    if (!name) return badRequest("Name is required.")

    const existing = await prisma.pledgeDocReturnCondition.findUnique({ where: { id } })
    if (!existing) return notFound("Return condition not found.")

    const updated = await prisma.pledgeDocReturnCondition.update({
      where: { id },
      data: {
        name,
        description: body?.description ? String(body.description).trim() : null,
        isActive: body?.isActive !== undefined ? Boolean(body.isActive) : existing.isActive,
        sortOrder: body?.sortOrder !== undefined ? Number(body.sortOrder) : existing.sortOrder,
      },
    })
    return NextResponse.json(updated)
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated yet.")
    console.error("Error updating return condition:", error)
    return internalServerError("Failed to update return condition.")
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
    const existing = await prisma.pledgeDocReturnCondition.findUnique({ where: { id } })
    if (!existing) return notFound("Return condition not found.")

    await prisma.pledgeDocReturnCondition.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated yet.")
    console.error("Error deleting return condition:", error)
    return internalServerError("Failed to delete return condition.")
  }
}
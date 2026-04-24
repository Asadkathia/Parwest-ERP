import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, notFound, serviceUnavailable, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "UPDATE")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })
    const { id } = await context.params
    const body = await request.json()
    const data: { name?: string } = {}

    if (body.name !== undefined) {
      const name = String(body.name || "").trim()
      if (!name) return badRequest("Name is required.")
      data.name = name
    }
    if (Object.keys(data).length === 0) return badRequest("No fields provided.")

    if (isRuntimeMockEnabled()) return NextResponse.json({ id, ...data })

    const updated = await prisma.guardBankName.update({
      where: { id },
      data,
    })
    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for guard bank names yet.")
    if (String((error as { code?: string }).code) === "P2025") return notFound("Bank name not found.")
    if (String((error as { code?: string }).code) === "P2002") return conflict("Bank name already exists.")
    console.error("Error updating guard bank name:", error)
    return internalServerError("Failed to update bank name.")
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "DELETE")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })
    const { id } = await context.params

    if (isRuntimeMockEnabled()) return NextResponse.json({ success: true, id })

    await prisma.guardBankName.delete({
      where: { id },
    })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for guard bank names yet.")
    if (String((error as { code?: string }).code) === "P2025") return notFound("Bank name not found.")
    console.error("Error deleting guard bank name:", error)
    return internalServerError("Failed to delete bank name.")
  }
}

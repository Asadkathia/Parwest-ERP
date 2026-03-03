import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, internalServerError, notFound, serviceUnavailable, unauthorized } from "@/lib/api/response"

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
    const dateRaw = body?.date != null ? String(body.date).trim() : undefined
    const notes = body?.notes !== undefined ? (body.notes ? String(body.notes) : null) : undefined
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (notes !== undefined) data.notes = notes
    if (dateRaw !== undefined) {
      const date = new Date(dateRaw)
      if (Number.isNaN(date.getTime())) return badRequest("Invalid date value.")
      data.date = date
    }
    if (Object.keys(data).length === 0) return badRequest("No fields provided.")

    if (isRuntimeMockEnabled()) return NextResponse.json({ id, ...data })

    const updated = await prisma.payrollHoliday.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for payroll holidays yet.")
    if (String((error as { code?: string }).code) === "P2025") return notFound("Holiday not found.")
    console.error("Error updating payroll holiday:", error)
    return internalServerError("Failed to update holiday.")
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

    if (isRuntimeMockEnabled()) return NextResponse.json({ success: true })

    await prisma.payrollHoliday.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for payroll holidays yet.")
    if (String((error as { code?: string }).code) === "P2025") return notFound("Holiday not found.")
    console.error("Error deleting payroll holiday:", error)
    return internalServerError("Failed to delete holiday.")
  }
}

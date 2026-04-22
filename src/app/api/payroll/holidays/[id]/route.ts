import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, forbidden, internalServerError, notFound, serviceUnavailable, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")
    const { id } = await context.params
    const body = await request.json()
    const name = body?.name != null ? String(body.name).trim() : undefined
    const dateRaw = body?.date != null ? String(body.date).trim() : undefined
    const dateFromRaw = body?.dateFrom != null ? String(body.dateFrom).trim() : undefined
    const dateToRaw = body?.dateTo != null ? String(body.dateTo).trim() : undefined
    const notes = body?.notes !== undefined ? (body.notes ? String(body.notes) : null) : undefined
    const comments = body?.comments !== undefined ? (body.comments ? String(body.comments) : null) : undefined
    const regionalOfficeId =
      body?.regionalOfficeId !== undefined
        ? body.regionalOfficeId
          ? String(body.regionalOfficeId)
          : null
        : undefined
    const valueType = body?.valueType !== undefined ? (body.valueType ? String(body.valueType).toUpperCase() : null) : undefined
    const value = body?.value !== undefined ? (body.value != null ? Number(body.value) : null) : undefined
    const status = body?.status !== undefined ? String(body.status) : undefined

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (notes !== undefined) data.notes = notes
    if (comments !== undefined) data.comments = comments
    if (regionalOfficeId !== undefined) data.regionalOfficeId = regionalOfficeId
    if (valueType !== undefined) data.valueType = valueType
    if (value !== undefined) data.value = value
    if (status !== undefined) data.status = status
    if (dateRaw !== undefined) {
      const date = new Date(dateRaw)
      if (Number.isNaN(date.getTime())) return badRequest("Invalid date value.")
      data.date = date
    }
    if (dateFromRaw !== undefined) {
      const d = new Date(dateFromRaw)
      if (Number.isNaN(d.getTime())) return badRequest("Invalid dateFrom value.")
      data.dateFrom = d
      if (data.date === undefined) data.date = d
    }
    if (dateToRaw !== undefined) {
      const d = new Date(dateToRaw)
      if (Number.isNaN(d.getTime())) return badRequest("Invalid dateTo value.")
      data.dateTo = d
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
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")
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

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const { id } = await context.params
    const body = await request.json()
    const name = body?.name != null ? String(body.name).trim() : undefined
    const dateRaw = body?.date != null ? String(body.date).trim() : undefined
    const notes = body?.notes !== undefined ? (body.notes ? String(body.notes) : null) : undefined
    const data: any = {}
    if (name !== undefined) data.name = name
    if (notes !== undefined) data.notes = notes
    if (dateRaw !== undefined) {
      const date = new Date(dateRaw)
      if (Number.isNaN(date.getTime())) return NextResponse.json({ message: "Invalid date value." }, { status: 400 })
      data.date = date
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ message: "No fields provided." }, { status: 400 })

    if (isMockEnabled()) return NextResponse.json({ id, ...data })

    const updated = await prisma.payrollHoliday.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (isPrismaMissingSchemaError(error)) return NextResponse.json({ message: "Schema not migrated for payroll holidays yet." }, { status: 503 })
    if (String(error?.code) === "P2025") return NextResponse.json({ message: "Holiday not found." }, { status: 404 })
    console.error("Error updating payroll holiday:", error)
    return NextResponse.json({ message: "Failed to update holiday." }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const { id } = await context.params

    if (isMockEnabled()) return NextResponse.json({ success: true })

    await prisma.payrollHoliday.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (isPrismaMissingSchemaError(error)) return NextResponse.json({ message: "Schema not migrated for payroll holidays yet." }, { status: 503 })
    if (String(error?.code) === "P2025") return NextResponse.json({ message: "Holiday not found." }, { status: 404 })
    console.error("Error deleting payroll holiday:", error)
    return NextResponse.json({ message: "Failed to delete holiday." }, { status: 500 })
  }
}

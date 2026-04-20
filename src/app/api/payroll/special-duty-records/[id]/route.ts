import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { internalServerError, notFound, unauthorized } from "@/lib/api/response"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id } = await params
    const body = await request.json()
    const existing = await prisma.payrollSpecialDuty.findUnique({ where: { id } })
    if (!existing) return notFound("Record not found.")

    const hours = body.hours != null ? Number(body.hours) : existing.hours
    const hourRate = body.hourRate != null ? Number(body.hourRate) : existing.hourRate
    const amount = Number((hours * hourRate).toFixed(2))

    const updated = await prisma.payrollSpecialDuty.update({
      where: { id },
      data: {
        dateFrom: body.dateFrom ? new Date(String(body.dateFrom)) : undefined,
        dateTo: body.dateTo ? new Date(String(body.dateTo)) : undefined,
        hours,
        hourRate,
        amount,
        comments: body.comments !== undefined ? (body.comments ? String(body.comments) : null) : undefined,
        attachmentBase64:
          body.attachmentBase64 !== undefined
            ? body.attachmentBase64
              ? String(body.attachmentBase64)
              : null
            : undefined,
        status: body.status ? String(body.status) : undefined,
      },
      include: { guard: { select: { id: true, parwestId: true, name: true } } },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating special duty record:", error)
    return internalServerError("Failed to update record.")
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id } = await params
    const existing = await prisma.payrollSpecialDuty.findUnique({ where: { id } })
    if (!existing) return notFound("Record not found.")

    await prisma.payrollSpecialDuty.update({
      where: { id },
      data: { status: "CANCELLED" },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error deleting special duty record:", error)
    return internalServerError("Failed to delete record.")
  }
}

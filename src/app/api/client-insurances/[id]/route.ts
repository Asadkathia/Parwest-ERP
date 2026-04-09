import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, notFound, unauthorized } from "@/lib/api/response"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id } = await context.params
    const body = await request.json()

    const data: Record<string, unknown> = {}
    if (body.insuranceName !== undefined) {
      const name = String(body.insuranceName || "").trim()
      if (!name) return badRequest("Insurance name is required.")
      data.insuranceName = name
    }
    if (body.status !== undefined) data.status = String(body.status)
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null

    if (Object.keys(data).length === 0) return badRequest("No fields provided.")

    const updated = await (prisma.clientInsurance as unknown as {
      update: (args: unknown) => Promise<unknown>
    }).update({
      where: { id },
      data,
      include: {
        client: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        event: "CLIENT_INSURANCE_UPDATED",
        module: "CLIENTS",
        description: `Insurance ${id} updated by ${session.user?.name || session.user?.email || "Unknown"}.`,
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") return notFound("Insurance not found.")
    console.error("Error updating client insurance:", error)
    return internalServerError("Failed to update insurance.")
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

    await (prisma.clientInsurance as unknown as {
      delete: (args: unknown) => Promise<unknown>
    }).delete({ where: { id } })

    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        event: "CLIENT_INSURANCE_DELETED",
        module: "CLIENTS",
        description: `Insurance ${id} deleted by ${session.user?.name || session.user?.email || "Unknown"}.`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") return notFound("Insurance not found.")
    console.error("Error deleting client insurance:", error)
    return internalServerError("Failed to delete insurance.")
  }
}

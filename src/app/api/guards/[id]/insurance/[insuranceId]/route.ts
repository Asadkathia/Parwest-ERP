import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, notFound, unauthorized } from "@/lib/api/response"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; insuranceId: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id: guardId, insuranceId } = await context.params
    const body = await request.json()

    const data: Record<string, unknown> = {}
    if (body.status !== undefined) data.status = String(body.status)
    if (body.healthId !== undefined) data.healthId = String(body.healthId || "").trim() || null

    if (Object.keys(data).length === 0) return badRequest("No fields provided.")

    const updated = await (prisma.guardInsurance as unknown as {
      update: (args: unknown) => Promise<unknown>
    }).update({
      where: { id: insuranceId, guardId },
      data,
      include: {
        clientInsurance: {
          include: { client: { select: { id: true, name: true } } },
        },
        createdBy: { select: { id: true, name: true } },
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        event: "GUARD_INSURANCE_UPDATED",
        module: "GUARDS",
        description: `Guard insurance ${insuranceId} updated by ${session.user?.name || session.user?.email || "Unknown"}. Fields: ${Object.keys(data).join(", ")}.`,
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") return notFound("Guard insurance not found.")
    console.error("Error updating guard insurance:", error)
    return internalServerError("Failed to update guard insurance.")
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; insuranceId: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id: guardId, insuranceId } = await context.params

    await (prisma.guardInsurance as unknown as {
      delete: (args: unknown) => Promise<unknown>
    }).delete({ where: { id: insuranceId, guardId } })

    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        event: "GUARD_INSURANCE_REMOVED",
        module: "GUARDS",
        description: `Guard insurance ${insuranceId} removed by ${session.user?.name || session.user?.email || "Unknown"}.`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") return notFound("Guard insurance not found.")
    console.error("Error deleting guard insurance:", error)
    return internalServerError("Failed to remove guard insurance.")
  }
}

import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { normalizeStatusColor } from "@/lib/guards/statusColors"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "UPDATE")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })

    const { id } = await params
    const body = await request.json()

    const data: Prisma.GuardStatusOptionUpdateInput = {}
    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) return badRequest("Name cannot be empty.")
      data.name = name
    }
    if (body.color !== undefined) data.color = normalizeStatusColor(body.color)
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder)

    const status = await prisma.guardStatusOption.update({ where: { id }, data })
    return NextResponse.json(status)
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") return notFound("Guard status not found.")
      if (err.code === "P2002") return badRequest("A status with this name already exists.")
    }
    return internalServerError("Failed to update guard status.")
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "GUARDS", "DELETE")) return Response.json({ success: false, message: "Forbidden", code: "FORBIDDEN" }, { status: 403 })

    const { id } = await params
    await prisma.guardStatusOption.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return notFound("Guard status not found.")
    }
    return internalServerError("Failed to delete guard status.")
  }
}

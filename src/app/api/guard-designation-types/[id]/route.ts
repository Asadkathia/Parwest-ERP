import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

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

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = String(body.name).trim()
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder)

    if (data.name === "") return badRequest("Name cannot be empty.")

    const type = await (prisma.guardDesignationType as unknown as {
      update: (args: unknown) => Promise<unknown>
    }).update({ where: { id }, data })
    return NextResponse.json(type)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ""
    if (msg.includes("Record to update not found")) return notFound("Designation type not found.")
    if (msg.includes("Unique constraint")) return badRequest("A designation with this name already exists.")
    return internalServerError("Failed to update designation type.")
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
    await (prisma.guardDesignationType as unknown as {
      delete: (args: unknown) => Promise<unknown>
    }).delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return internalServerError("Failed to delete designation type.")
  }
}
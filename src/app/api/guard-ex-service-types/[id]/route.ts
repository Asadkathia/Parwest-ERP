import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { badRequest, internalServerError, notFound, unauthorized } from "@/lib/api/response"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id } = await params
    const body = await request.json()

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = String(body.name).trim().toUpperCase()
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder)

    if (data.name === "") return badRequest("Name cannot be empty.")

    const type = await (prisma.guardExServiceType as unknown as {
      update: (args: unknown) => Promise<unknown>
    }).update({ where: { id }, data })
    return NextResponse.json(type)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ""
    if (msg.includes("Record to update not found")) return notFound("Ex-service type not found.")
    if (msg.includes("Unique constraint")) return badRequest("A type with this name already exists.")
    return internalServerError("Failed to update ex-service type.")
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
    await (prisma.guardExServiceType as unknown as {
      delete: (args: unknown) => Promise<unknown>
    }).delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return internalServerError("Failed to delete ex-service type.")
  }
}

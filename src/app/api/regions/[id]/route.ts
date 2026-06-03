import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { badRequest, conflict, internalServerError, notFound, unauthorized, forbidden } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return unauthorized()
    }
    if (!hasAction(session, "SETTINGS", "UPDATE")) return forbidden()
    const { id } = await context.params
    const body = await request.json()
    const name = String(body?.name || "").trim()

    if (!name) {
      return badRequest("Region name is required.")
    }

    const updated = await prisma.region.update({
      where: { id },
      data: { name },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") {
      return notFound("Region not found.")
    }
    if (String((error as { code?: string }).code) === "P2002") {
      return conflict("Region already exists.")
    }
    console.error("Error updating region:", error)
    return internalServerError("Failed to update region")
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return unauthorized()
    }
    if (!hasAction(session, "SETTINGS", "DELETE")) return forbidden()
    const { id } = await context.params

    await prisma.region.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") {
      return notFound("Region not found.")
    }
    if (String((error as { code?: string }).code) === "P2003") {
      return conflict("Region is in use by offices/users/guards/clients.")
    }
    console.error("Error deleting region:", error)
    return internalServerError("Failed to delete region")
  }
}

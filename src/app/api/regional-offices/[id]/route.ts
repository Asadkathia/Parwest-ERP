import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { badRequest, conflict, internalServerError, notFound, unauthorized } from "@/lib/api/response"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return unauthorized()
    }
    const { id } = await context.params
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.name != null) data.name = String(body.name).trim()
    if (body.seriesCode != null) data.seriesCode = String(body.seriesCode).trim().toUpperCase()
    if (body.regionId != null) data.regionId = String(body.regionId).trim()
    if (body.officeHead !== undefined) data.officeHead = body.officeHead ? String(body.officeHead) : null
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone) : null
    if (body.mobile !== undefined) data.mobile = body.mobile ? String(body.mobile) : null
    if (body.fax !== undefined) data.fax = body.fax ? String(body.fax) : null
    if (body.latitude !== undefined) {
      data.latitude = body.latitude !== null && body.latitude !== "" ? parseFloat(String(body.latitude)) : null
    }
    if (body.longitude !== undefined) {
      data.longitude = body.longitude !== null && body.longitude !== "" ? parseFloat(String(body.longitude)) : null
    }

    if (Object.keys(data).length === 0) {
      return badRequest("No valid fields provided.")
    }

    if (isRuntimeMockEnabled()) {
      return NextResponse.json({ id, ...data, updatedAt: new Date().toISOString() })
    }

    const updated = await prisma.regionalOffice.update({
      where: { id },
      data,
      include: { region: true },
    })
    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") {
      return notFound("Regional office not found.")
    }
    if (String((error as { code?: string }).code) === "P2002") {
      return conflict("Office name/series code already exists.")
    }
    if (String((error as { code?: string }).code) === "P2003") {
      return badRequest("Invalid region selected.")
    }
    console.error("Error updating regional office:", error)
    return internalServerError("Failed to update regional office")
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
    const { id } = await context.params

    if (isRuntimeMockEnabled()) {
      return NextResponse.json({ success: true })
    }

    await prisma.regionalOffice.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") {
      return notFound("Regional office not found.")
    }
    if (String((error as { code?: string }).code) === "P2003") {
      return conflict("Regional office is in use.")
    }
    console.error("Error deleting regional office:", error)
    return internalServerError("Failed to delete regional office")
  }
}

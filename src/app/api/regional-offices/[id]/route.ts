import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    const { id } = await context.params
    const body = await request.json()
    const data: any = {}

    if (body.name != null) data.name = String(body.name).trim()
    if (body.seriesCode != null) data.seriesCode = String(body.seriesCode).trim().toUpperCase()
    if (body.regionId != null) data.regionId = String(body.regionId).trim()
    if (body.officeHead !== undefined) data.officeHead = body.officeHead ? String(body.officeHead) : null
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone) : null
    if (body.mobile !== undefined) data.mobile = body.mobile ? String(body.mobile) : null
    if (body.fax !== undefined) data.fax = body.fax ? String(body.fax) : null

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: "No valid fields provided." }, { status: 400 })
    }

    if (isMockEnabled()) {
      return NextResponse.json({ id, ...data, updatedAt: new Date().toISOString() })
    }

    const updated = await prisma.regionalOffice.update({
      where: { id },
      data,
      include: { region: true },
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (String(error?.code) === "P2025") {
      return NextResponse.json({ message: "Regional office not found." }, { status: 404 })
    }
    if (String(error?.code) === "P2002") {
      return NextResponse.json({ message: "Office name/series code already exists." }, { status: 409 })
    }
    if (String(error?.code) === "P2003") {
      return NextResponse.json({ message: "Invalid region selected." }, { status: 400 })
    }
    console.error("Error updating regional office:", error)
    return NextResponse.json({ message: "Failed to update regional office" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    const { id } = await context.params

    if (isMockEnabled()) {
      return NextResponse.json({ success: true })
    }

    await prisma.regionalOffice.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (String(error?.code) === "P2025") {
      return NextResponse.json({ message: "Regional office not found." }, { status: 404 })
    }
    if (String(error?.code) === "P2003") {
      return NextResponse.json({ message: "Regional office is in use." }, { status: 409 })
    }
    console.error("Error deleting regional office:", error)
    return NextResponse.json({ message: "Failed to delete regional office" }, { status: 500 })
  }
}

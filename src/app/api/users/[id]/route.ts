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

    if (body.name != null) data.name = String(body.name)
    if (body.status != null) data.status = String(body.status)
    if (body.contactNumber != null) data.contactNumber = String(body.contactNumber)
    if (body.roleId != null) data.roleId = String(body.roleId)
    if (body.regionId !== undefined) data.regionId = body.regionId ? String(body.regionId) : null
    if (body.regionalOfficeId !== undefined) data.regionalOfficeId = body.regionalOfficeId ? String(body.regionalOfficeId) : null

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: "No valid fields provided for update." }, { status: 400 })
    }

    if (isMockEnabled()) {
      return NextResponse.json({ id, ...data })
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      include: {
        role: { select: { id: true, name: true } },
        region: { select: { id: true, name: true } },
        regionalOffice: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    if (String(error?.code) === "P2025") {
      return NextResponse.json({ message: "User not found." }, { status: 404 })
    }
    if (String(error?.code) === "P2003") {
      return NextResponse.json({ message: "Invalid role, region, or office." }, { status: 400 })
    }
    console.error("Error updating user:", error)
    return NextResponse.json({ message: "Failed to update user" }, { status: 500 })
  }
}

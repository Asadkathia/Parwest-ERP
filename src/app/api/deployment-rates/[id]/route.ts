import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
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

    const updated = await prisma.deploymentRate.update({
      where: { id },
      data: {
        regionId: body.regionId || undefined,
        clientId: body.clientId || undefined,
        branchId: body.branchId || undefined,
        deployAs: body.deployAs || undefined,
        guardType: body.guardType || undefined,
        shiftType: body.shiftType || undefined,
        salary: body.salary != null ? Number(body.salary) : undefined,
        overtime: body.overtime != null ? Number(body.overtime) : undefined,
        extraHours: body.extraHours != null ? Number(body.extraHours) : undefined,
        postAllowance: body.postAllowance != null ? Number(body.postAllowance) : undefined,
      },
      include: {
        region: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") return notFound("Deployment rate not found")
    console.error("Error updating deployment rate:", error)
    return internalServerError("Failed to update deployment rate")
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { id } = await params
    await prisma.deploymentRate.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") return notFound("Deployment rate not found")
    console.error("Error deleting deployment rate:", error)
    return internalServerError("Failed to delete deployment rate")
  }
}

import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"

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
    const data: Prisma.UserUncheckedUpdateInput = {}
    const managerScope = deriveManagerScope(session)

    if (body.name != null) data.name = String(body.name)
    if (body.status != null) data.status = String(body.status)
    if (body.contactNumber != null) data.contactNumber = String(body.contactNumber)
    if (body.roleId != null) data.roleId = String(body.roleId)
    if (body.regionId !== undefined) data.regionId = body.regionId ? String(body.regionId) : null
    if (body.regionalOfficeId !== undefined) data.regionalOfficeId = body.regionalOfficeId ? String(body.regionalOfficeId) : null

    if (Object.keys(data).length === 0) {
      return badRequest("No valid fields provided for update.")
    }

    if (isMockEnabled()) {
      return NextResponse.json({ id, ...data })
    }

    if (managerScope) {
      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, regionId: true, regionalOfficeId: true },
      })
      if (!existingUser) {
        return notFound("User not found.")
      }

      if (managerScopeDenied(managerScope, { regionId: existingUser.regionId, regionalOfficeId: existingUser.regionalOfficeId })) {
        return forbidden("Forbidden: user is outside your scope.")
      }

      const targetRegionId = data.regionId === undefined ? existingUser.regionId : (data.regionId as string | null)
      const targetRegionalOfficeId =
        data.regionalOfficeId === undefined
          ? existingUser.regionalOfficeId
          : (data.regionalOfficeId as string | null)
      if (managerScopeDenied(managerScope, { regionId: targetRegionId, regionalOfficeId: targetRegionalOfficeId })) {
        return forbidden("Forbidden: cannot move user outside your scope.")
      }
    }

    const actorId = session.user?.id || null
    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data,
        include: {
          role: { select: { id: true, name: true } },
          region: { select: { id: true, name: true } },
          regionalOffice: { select: { id: true, name: true } },
        },
      })

      await tx.auditLog.create({
        data: {
          userId: actorId,
          event: "USER_UPDATED",
          module: "USERS",
          description: `Updated user ${id}; fields: ${Object.keys(data).join(", ")}`,
        },
      })
      return user
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (getPrismaCode(error) === "P2025") {
      return notFound("User not found.")
    }
    if (getPrismaCode(error) === "P2003") {
      return badRequest("Invalid role, region, or office.")
    }
    console.error("Error updating user:", error)
    return internalServerError("Failed to update user")
  }
}

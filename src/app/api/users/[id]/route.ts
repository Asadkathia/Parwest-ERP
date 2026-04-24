import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { getPrismaCode } from "@/lib/prisma-errors"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
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
    if (!hasAction(session, "USERS", "UPDATE")) return forbidden("Access denied.")

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

    if (isRuntimeMockEnabled()) {
      return NextResponse.json({ id, ...data })
    }

    // Enforce role scope ↔ region consistency when role/region is being changed.
    if (data.roleId !== undefined || data.regionId !== undefined || data.regionalOfficeId !== undefined) {
      const current = await prisma.user.findUnique({
        where: { id },
        select: { roleId: true, regionId: true, regionalOfficeId: true },
      })
      if (!current) return notFound("User not found.")

      const targetRoleId = (data.roleId as string | undefined) ?? current.roleId
      const targetRegionId = data.regionId === undefined ? current.regionId : (data.regionId as string | null)
      const targetOfficeId = data.regionalOfficeId === undefined ? current.regionalOfficeId : (data.regionalOfficeId as string | null)

      const role = await prisma.role.findUnique({
        where: { id: targetRoleId },
        select: { scopeType: true, name: true },
      })
      if (!role) return badRequest("Invalid roleId.")
      if (role.scopeType === "REGIONAL") {
        if (!targetRegionId || !targetOfficeId) {
          return badRequest(`Role "${role.name}" is regional — regionId and regionalOfficeId are required.`)
        }
      } else {
        if (targetRegionId || targetOfficeId) {
          return badRequest(`Role "${role.name}" is global — it cannot be assigned to a region or office.`)
        }
      }
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
    const updated = await prisma.user.update({
      where: { id },
      data,
      include: {
        role: { select: { id: true, name: true } },
        region: { select: { id: true, name: true } },
        regionalOffice: { select: { id: true, name: true } },
      },
    })

    await safeAuditLog({
      userId: actorId,
      event: "USER_UPDATED",
      module: "USERS",
      description: `Updated user ${id}; fields: ${Object.keys(data).join(", ")}`,
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

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "USERS", "DELETE")) return forbidden("Access denied.")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actorRole = (session.user as any)?.role as string | undefined
    if (actorRole !== "Admin") return forbidden("Only Admin can delete users.")

    const { id } = await context.params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actorId = (session.user as any)?.id as string | undefined

    if (id === actorId) {
      return NextResponse.json({ message: "You cannot delete your own account." }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true },
    })
    if (!user) return notFound("User not found.")

    await prisma.user.delete({ where: { id } })
    await safeAuditLog({
      userId: actorId ?? null,
      event: "USER_DELETED",
      module: "USERS",
      description: `Deleted user ${user.id} (${user.email} — ${user.name})`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/users/[id]:", error)
    return internalServerError("Failed to delete user.")
  }
}

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { conflict, forbidden, internalServerError, notFound, ok, unauthorized } from "@/lib/api/response"
import { isSuperAdmin } from "@/lib/api/permissions"

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    // 🔒 Only SuperAdmin can delete roles. The previous `role !== "Admin"` check
    // blocked real Super Users (role = "Super User") while allowing regional
    // Admins (role = "Admin" + permissions) to delete global roles.
    if (!isSuperAdmin(session)) {
      return forbidden("Only SuperAdmin can delete roles.")
    }

    const { id } = await params

    if (isRuntimeMockEnabled()) {
      return ok({ deleted: true, message: "Role deleted (mock)." })
    }

    // Check the role exists
    const role = await prisma.role.findUnique({ where: { id } })
    if (!role) return notFound("Role not found.")

    // Check no users are assigned to this role
    const usersWithRole = await prisma.user.count({ where: { roleId: id } })
    if (usersWithRole > 0) {
      return conflict(`Cannot delete: ${usersWithRole} user(s) are assigned to this role. Reassign them first.`)
    }

    await prisma.role.delete({ where: { id } })

    return ok({ deleted: true, message: `Role "${role.name}" deleted.` })
  } catch (error) {
    console.error("Error deleting role:", error)
    return internalServerError("Failed to delete role.")
  }
}

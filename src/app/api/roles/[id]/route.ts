import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    // Only Admin role can delete roles
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userRole = (session.user as any)?.role as string | undefined
    if (userRole !== "Admin") {
      return forbidden("Only Admin users can delete roles.")
    }

    const { id } = await params

    if (isRuntimeMockEnabled()) {
      return NextResponse.json({ success: true, message: "Role deleted (mock)." })
    }

    // Check the role exists
    const role = await prisma.role.findUnique({ where: { id } })
    if (!role) return notFound("Role not found.")

    // Check no users are assigned to this role
    const usersWithRole = await prisma.user.count({ where: { roleId: id } })
    if (usersWithRole > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot delete: ${usersWithRole} user(s) are assigned to this role. Reassign them first.`,
          code: "ROLE_IN_USE",
        },
        { status: 409 }
      )
    }

    await prisma.role.delete({ where: { id } })

    return NextResponse.json({ success: true, message: `Role "${role.name}" deleted.` })
  } catch (error) {
    console.error("Error deleting role:", error)
    return internalServerError("Failed to delete role.")
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { MODULES } from "@/lib/constants/permissions"

type PermissionPayload = {
    module?: unknown
    canCreate?: unknown
    canView?: unknown
    canUpdate?: unknown
    canDelete?: unknown
    canRequisition?: unknown
}

// GET /api/user-permissions?userId=xxx
// Returns merged permissions: role-level (inherited) + user-level (additional)
// Each row has a `source` field: "ROLE" | "USER" | "BOTH"
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) return unauthorized()

        const { searchParams } = new URL(request.url)
        const userId = searchParams.get("userId")
        if (!userId) return badRequest("userId is required.")

        // Get the user's roleId
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { roleId: true },
        })

        const [userPerms, rolePerms] = await Promise.all([
            prisma.userPermission.findMany({ where: { userId }, orderBy: { module: "asc" } }),
            user?.roleId
                ? prisma.rolePermission.findMany({ where: { roleId: user.roleId }, orderBy: { module: "asc" } })
                : Promise.resolve([]),
        ])

        const rolePermMap = new Map(rolePerms.map((p) => [p.module, p]))
        const userPermMap = new Map(userPerms.map((p) => [p.module, p]))

        // Merge: for each module, combine role-level and user-level permissions
        const merged = MODULES.map((module) => {
            const rp = rolePermMap.get(module)
            const up = userPermMap.get(module)

            const fromRole = {
                canCreate:      rp?.canCreate      ?? false,
                canView:        rp?.canView        ?? false,
                canUpdate:      rp?.canUpdate      ?? false,
                canDelete:      rp?.canDelete      ?? false,
                canRequisition: rp?.canRequisition ?? false,
            }
            const fromUser = {
                canCreate:      up?.canCreate      ?? false,
                canView:        up?.canView        ?? false,
                canUpdate:      up?.canUpdate      ?? false,
                canDelete:      up?.canDelete      ?? false,
                canRequisition: up?.canRequisition ?? false,
            }

            const source = rp && up ? "BOTH" : rp ? "ROLE" : up ? "USER" : "NONE"

            return {
                id:             up?.id ?? rp?.id ?? `virtual-${module}`,
                userId,
                module,
                // Effective = role OR user (union)
                canCreate:      fromRole.canCreate      || fromUser.canCreate,
                canView:        fromRole.canView        || fromUser.canView,
                canUpdate:      fromRole.canUpdate      || fromUser.canUpdate,
                canDelete:      fromRole.canDelete      || fromUser.canDelete,
                canRequisition: fromRole.canRequisition || fromUser.canRequisition,
                // Per-action breakdown
                fromRole,
                fromUser,
                source,
            }
        })

        return NextResponse.json(merged)
    } catch (error) {
        console.error("Error fetching user permissions:", error)
        return internalServerError("Failed to fetch user permissions")
    }
}

// DELETE /api/user-permissions?userId=xxx[&module=YYY]
// Removes ADDITIONAL user-level permissions. With no `module` param, clears
// all overrides for the user. With `module`, clears overrides for that module
// only.
export async function DELETE(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasAction(session, "USERS", "UPDATE")) return forbidden()

        const { searchParams } = new URL(request.url)
        const userId = searchParams.get("userId")
        const moduleName = searchParams.get("module") ?? undefined
        if (!userId) return badRequest("userId is required.")

        const where = moduleName ? { userId, module: moduleName } : { userId }
        const result = await prisma.userPermission.deleteMany({ where })

        return NextResponse.json({ success: true, deleted: result.count })
    } catch (error) {
        console.error("Error deleting user permissions:", error)
        return internalServerError("Failed to delete user permissions")
    }
}

// PUT /api/user-permissions
// Saves ADDITIONAL user-level permissions (does not touch role permissions)
export async function PUT(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        if (!hasAction(session, "USERS", "UPDATE")) return forbidden()

        const body = await request.json()
        const userId = String(body?.userId || "").trim()
        const permissions = Array.isArray(body?.permissions) ? body.permissions : []

        if (!userId) return badRequest("userId is required.")
        if (permissions.length === 0) return badRequest("permissions array is required.")

        const normalized = permissions as PermissionPayload[]
        const data = normalized.map((p) => ({
            userId,
            module: String(p.module),
            canCreate:      Boolean(p.canCreate),
            canView:        Boolean(p.canView),
            canUpdate:      Boolean(p.canUpdate),
            canDelete:      Boolean(p.canDelete),
            canRequisition: Boolean(p.canRequisition),
        }))

        await prisma.$transaction([
            prisma.userPermission.deleteMany({ where: { userId } }),
            prisma.userPermission.createMany({ data }),
        ])

        const rows = await prisma.userPermission.findMany({
            where: { userId },
            orderBy: { module: "asc" },
        })

        return NextResponse.json(rows)
    } catch (error: unknown) {
        if (String((error as { code?: string }).code) === "P2003") {
            return badRequest("Invalid userId.")
        }
        console.error("Error saving user permissions:", error)
        return internalServerError("Failed to save user permissions")
    }
}
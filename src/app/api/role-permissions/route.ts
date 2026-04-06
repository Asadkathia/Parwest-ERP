import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"

type PermissionPayload = {
    module?: unknown
    canCreate?: unknown
    canView?: unknown
    canUpdate?: unknown
    canDelete?: unknown
    canRequisition?: unknown
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) return unauthorized()

        const { searchParams } = new URL(request.url)
        const roleId = searchParams.get("roleId")

        if (!roleId) return badRequest("roleId is required.")

        const rows = await prisma.rolePermission.findMany({
            where: { roleId },
            orderBy: { module: "asc" },
        })

        return NextResponse.json(rows)
    } catch (error) {
        console.error("Error fetching role permissions:", error)
        return internalServerError("Failed to fetch role permissions")
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) return unauthorized()

        // Only admins can configure role permissions
        const userRole = (session.user as { role?: string })?.role ?? ""
        if (userRole.toLowerCase() !== "admin") {
            return forbidden("Only admins can configure role permissions.")
        }

        const body = await request.json()
        const roleId = String(body?.roleId || "").trim()
        const permissions = Array.isArray(body?.permissions) ? body.permissions : []

        if (!roleId) return badRequest("roleId is required.")
        if (permissions.length === 0) return badRequest("permissions array is required.")

        const normalized = permissions as PermissionPayload[]
        const data = normalized.map((p) => ({
            roleId,
            module: String(p.module),
            canCreate: Boolean(p.canCreate),
            canView: Boolean(p.canView),
            canUpdate: Boolean(p.canUpdate),
            canDelete: Boolean(p.canDelete),
            canRequisition: Boolean(p.canRequisition),
        }))

        const role = await prisma.role.findUnique({ where: { id: roleId }, select: { name: true } })

        await prisma.$transaction([
            prisma.rolePermission.deleteMany({ where: { roleId } }),
            prisma.rolePermission.createMany({ data }),
            prisma.auditLog.create({
                data: {
                    userId: session.user.id,
                    event: "ROLE_PERMISSIONS_UPDATED",
                    module: "USERS",
                    description: `Permissions updated for role "${role?.name ?? roleId}" by ${(session.user as { name?: string })?.name ?? session.user.email}`,
                },
            }),
        ])

        const rows = await prisma.rolePermission.findMany({
            where: { roleId },
            orderBy: { module: "asc" },
        })

        return NextResponse.json(rows)
    } catch (error) {
        console.error("Error saving role permissions:", error)
        return internalServerError("Failed to save role permissions")
    }
}
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { MODULES } from "@/lib/constants/permissions"
import { resolveEffectivePermissionFlags } from "@/lib/permissions/resolve"

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
//
// Effective values are computed via the shared `resolveEffectivePermissionFlags`
// resolver (UNION per action), the SAME function used by `lib/auth.ts` to
// build the JWT-enforced permission set. Display and enforcement therefore
// cannot drift. See `src/lib/permissions/resolve.ts`.
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session) return unauthorized()
        // Read gate: reading any user's effective-permissions matrix is a
        // permission-matrix disclosure (useful for targeting escalation),
        // so gate to USERS:VIEW.
        if (!hasAction(session, "USERS", "VIEW")) return forbidden()

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

        // Compute effective flags via the shared resolver (UNION per action).
        const resolved = resolveEffectivePermissionFlags({
            modules: MODULES,
            roleRows: rolePerms,
            userRows: userPerms,
        })
        const resolvedByModule = new Map(resolved.map((r) => [r.module, r]))

        // Shape rows for the manager UI (keeps id/source/fromRole/fromUser).
        const merged = MODULES.map((module) => {
            const rp = rolePermMap.get(module)
            const up = userPermMap.get(module)
            const r = resolvedByModule.get(module)!
            const source = rp && up ? "BOTH" : rp ? "ROLE" : up ? "USER" : "NONE"
            return {
                id:             up?.id ?? rp?.id ?? `virtual-${module}`,
                userId,
                module,
                // Effective = role OR user (union) — from shared resolver.
                canCreate:      r.effective.canCreate,
                canView:        r.effective.canView,
                canUpdate:      r.effective.canUpdate,
                canDelete:      r.effective.canDelete,
                canRequisition: r.effective.canRequisition,
                // Per-source breakdown (for the manager checkbox grid).
                fromRole:       r.fromRole,
                fromUser:       r.fromUser,
                source,
            }
        })

        // NOTE on envelope: returned as a raw array (not `ok(merged)`).
        // Live consumer `UserPermissionsManager.tsx` parses `Array.isArray(data)`
        // and would silently render empty if wrapped today. Flip to `ok(...)`
        // in lockstep with the consumer migration; consumer is outside this
        // agent's edit lane.
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
// Saves ADDITIONAL user-level permissions (does not touch role permissions).
//
// ADDITIVE-DELTA contract:
//   The payload contains ONLY user-level OVERRIDE deltas — NOT role permissions.
//   The UserPermissionsManager UI guarantees this structurally: role-granted
//   checkboxes are disabled (see UserPermissionsManager.tsx:347), so the
//   submitted rows never include actions already granted by the role.
//   Enforcement reads these as additive via the shared `resolveEffectivePermissions`
//   resolver (UNION per action) in `lib/auth.ts buildPermissionSet` — the
//   user's effective set is `role-rows ∪ user-rows` on next token refresh.
//   This handler MUST NOT implicitly substitute the full role-perms set;
//   doing so would cause user-rows to subsume role-rows, defeating the
//   resolver's additive intent (and effectively re-introducing the silent
//   revocation bug if the resolver ever changed semantics).
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
        // Store EXACTLY what the client sent (additive deltas only).
        // We do not merge with role rows here; the resolver does the union at
        // read time.
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
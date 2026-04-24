import NextAuth from "next-auth"
import type { Adapter } from "next-auth/adapters"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { authConfig } from "@/auth.config"
import { permissionKey } from "@/lib/constants/permissions"

/**
 * A permission row shape common to RolePermission and UserPermission.
 * We only need the per-action booleans + module name.
 */
type ActionRow = {
    module: string
    canCreate?: boolean | null
    canView?: boolean | null
    canUpdate?: boolean | null
    canDelete?: boolean | null
    canRequisition?: boolean | null
}

/**
 * Collapse a merged row (role OR user override) into the set of permission
 * strings to emit. Emits BOTH the legacy module-only key AND the per-action
 * keys (e.g. `"GUARDS"`, `"GUARDS:VIEW"`, `"GUARDS:CREATE"`).
 */
function addRowPermissions(set: Set<string>, row: ActionRow): void {
    const module = row.module
    const any =
        row.canCreate || row.canView || row.canUpdate || row.canDelete || row.canRequisition
    if (!any) return
    set.add(module)
    if (row.canCreate) set.add(permissionKey(module, "CREATE"))
    if (row.canView) set.add(permissionKey(module, "VIEW"))
    if (row.canUpdate) set.add(permissionKey(module, "UPDATE"))
    if (row.canDelete) set.add(permissionKey(module, "DELETE"))
    if (row.canRequisition) set.add(permissionKey(module, "REQUISITIONS"))
}

/**
 * Build the effective permission string set for a user.
 * User-level overrides replace role-level rows per [userId, module] — matching
 * the existing convention in the user-permissions UI and API.
 */
function buildPermissionSet(userRows: ActionRow[], roleRows: ActionRow[]): string[] {
    const userModules = new Set(userRows.map((r) => r.module))
    const set = new Set<string>()
    // Role rows first, but skip modules that have a user-level override.
    for (const row of roleRows) {
        if (userModules.has(row.module)) continue
        addRowPermissions(set, row)
    }
    for (const row of userRows) {
        addRowPermissions(set, row)
    }
    return Array.from(set)
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(prisma) as Adapter,
    providers: [
        Credentials({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null
                }

                const user = await prisma.user.findUnique({
                    where: {
                        email: credentials.email as string,
                    },
                    include: {
                        role: true,
                        regionalOffice: true,
                    },
                })

                if (!user || user.status !== "ACTIVE") {
                    return null
                }

                const passwordMatch = isRuntimeMockEnabled()
                    ? credentials.password === "admin123@" || credentials.password === "admin"
                    : await bcrypt.compare(
                        credentials.password as string,
                        user.password
                    )

                if (!passwordMatch) {
                    return null
                }

                // Load effective permissions.
                // Emits BOTH legacy module-only keys ("GUARDS") AND per-action keys
                // ("GUARDS:VIEW", "GUARDS:CREATE", ...) for backward compatibility.
                // User-level rows override role-level rows per [userId, module].
                let permissions: string[] = []
                try {
                    const anyEnabled = [
                        { canView: true }, { canCreate: true }, { canUpdate: true },
                        { canDelete: true }, { canRequisition: true },
                    ]
                    const actionSelect = {
                        module: true,
                        canCreate: true,
                        canView: true,
                        canUpdate: true,
                        canDelete: true,
                        canRequisition: true,
                    } as const
                    const [userPerms, rolePerms] = await Promise.all([
                        prisma.userPermission.findMany({
                            where: { userId: user.id, OR: anyEnabled },
                            select: actionSelect,
                        }),
                        prisma.rolePermission.findMany({
                            where: { roleId: user.roleId, OR: anyEnabled },
                            select: actionSelect,
                        }).catch(() => [] as ActionRow[]),
                    ])
                    permissions = buildPermissionSet(userPerms, rolePerms)
                } catch {
                    permissions = []
                }

                // Stamp last login time (fire-and-forget, don't block auth)
                prisma.user.update({
                    where: { id: user.id },
                    data: { lastLoginAt: new Date() },
                }).catch(() => {})

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role.name,
                    regionId: user.regionId,
                    regionalOfficeId: user.regionalOfficeId,
                    permissions,
                }
            },
        }),
    ],
    callbacks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async jwt({ token, user }: { token: any; user?: any }) {
            // On initial sign-in, user object is present — copy fields into token
            if (user) {
                token.id = user.id
                token.role = user.role
                token.regionId = user.regionId ?? null
                token.regionalOfficeId = user.regionalOfficeId ?? null
                token.permissions = user.permissions ?? []
            } else if (token.id) {
                // On subsequent requests, refresh effective permissions.
                // Same semantics as initial sign-in: user-level overrides role-level
                // per [userId, module], and each row contributes a module key plus
                // every per-action key its booleans enable.
                try {
                    const anyEnabled = [
                        { canView: true }, { canCreate: true }, { canUpdate: true },
                        { canDelete: true }, { canRequisition: true },
                    ]
                    const actionSelect = {
                        module: true,
                        canCreate: true,
                        canView: true,
                        canUpdate: true,
                        canDelete: true,
                        canRequisition: true,
                    } as const
                    const dbUser = await prisma.user.findUnique({
                        where: { id: token.id as string },
                        select: { roleId: true },
                    })
                    const [userPerms, rolePerms] = await Promise.all([
                        prisma.userPermission.findMany({
                            where: { userId: token.id as string, OR: anyEnabled },
                            select: actionSelect,
                        }),
                        dbUser?.roleId
                            ? prisma.rolePermission.findMany({
                                  where: { roleId: dbUser.roleId, OR: anyEnabled },
                                  select: actionSelect,
                              })
                            : Promise.resolve([] as ActionRow[]),
                    ])
                    token.permissions = buildPermissionSet(userPerms, rolePerms)
                } catch {
                    // Keep existing permissions on DB error
                }
            }
            return token
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        session({ session, token }: { session: any; token: any }) {
            if (session.user) {
                session.user.id = token.id as string
                session.user.role = token.role as string
                session.user.regionId = (token.regionId as string | null) ?? null
                session.user.regionalOfficeId = (token.regionalOfficeId as string | null) ?? null
                session.user.permissions = (token.permissions as string[]) ?? []
            }
            return session
        },
    },
})

import NextAuth from "next-auth"
import type { Adapter } from "next-auth/adapters"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { authConfig } from "@/auth.config"
import {
    resolveEffectivePermissions,
    type ActionRow,
} from "@/lib/permissions/resolve"

/**
 * Build the effective permission string set for a user.
 *
 * Delegates to the shared `resolveEffectivePermissions` resolver so that the
 * ENFORCED set (this function, stamped into the JWT) and the DISPLAYED set
 * (`api/user-permissions` GET, shown in the UI) use identical UNION logic
 * and cannot drift again. See `src/lib/permissions/resolve.ts`.
 *
 * Semantic: role + user override are merged per action via OR. A user
 * override row is ADDITIVE — it cannot strip a role-granted action. (The
 * UserPermissionsManager UI already disables role-granted checkboxes, so
 * saved overrides are structurally additive.)
 */
function buildPermissionSet(userRows: ActionRow[], roleRows: ActionRow[]): string[] {
    return resolveEffectivePermissions({ roleRows, userRows })
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
                        region: { select: { name: true } },
                        regionalOffice: { select: { name: true } },
                    },
                })

                if (!user || user.status !== "ACTIVE") {
                    return null
                }

                const passwordMatch = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                )

                if (!passwordMatch) {
                    return null
                }

                // Load effective permissions.
                // Emits BOTH legacy module-only keys ("GUARDS") AND per-action keys
                // ("GUARDS:VIEW", "GUARDS:CREATE", ...) for backward compatibility.
                // Role + user-override rows are UNIONed per action via
                // resolveEffectivePermissions (a user override ADDS to role grants,
                // it does not replace them) — see src/lib/permissions/resolve.ts.
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
                    roleScopeType: user.role.scopeType,
                    regionId: user.regionId,
                    regionalOfficeId: user.regionalOfficeId,
                    regionName: user.region?.name ?? null,
                    regionalOfficeName: user.regionalOffice?.name ?? null,
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
                token.roleScopeType = user.roleScopeType
                token.regionId = user.regionId ?? null
                token.regionalOfficeId = user.regionalOfficeId ?? null
                token.regionName = user.regionName ?? null
                token.regionalOfficeName = user.regionalOfficeName ?? null
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
                        select: {
                            roleId: true,
                            regionId: true,
                            regionalOfficeId: true,
                            role: { select: { scopeType: true } },
                            region: { select: { name: true } },
                            regionalOffice: { select: { name: true } },
                        },
                    })
                    if (dbUser?.role?.scopeType) {
                        token.roleScopeType = dbUser.role.scopeType
                    }
                    token.regionId = dbUser?.regionId ?? null
                    token.regionalOfficeId = dbUser?.regionalOfficeId ?? null
                    token.regionName = dbUser?.region?.name ?? null
                    token.regionalOfficeName = dbUser?.regionalOffice?.name ?? null
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
                session.user.roleScopeType = (token.roleScopeType as "GLOBAL" | "REGIONAL" | undefined) ?? undefined
                session.user.regionId = (token.regionId as string | null) ?? null
                session.user.regionalOfficeId = (token.regionalOfficeId as string | null) ?? null
                session.user.regionName = (token.regionName as string | null) ?? null
                session.user.regionalOfficeName = (token.regionalOfficeName as string | null) ?? null
                session.user.permissions = (token.permissions as string[]) ?? []
            }
            return session
        },
    },
})

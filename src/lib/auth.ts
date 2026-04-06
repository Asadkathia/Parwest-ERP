import NextAuth from "next-auth"
import type { Adapter } from "next-auth/adapters"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { authConfig } from "@/auth.config"

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

                // Load effective permissions = role permissions UNION user permissions.
                // Any module with at least one true flag from either source is included.
                let permissions: string[] = []
                try {
                    const anyEnabled = [
                        { canView: true }, { canCreate: true }, { canUpdate: true },
                        { canDelete: true }, { canRequisition: true },
                    ]
                    const [userPerms, rolePerms] = await Promise.all([
                        prisma.userPermission.findMany({
                            where: { userId: user.id, OR: anyEnabled },
                            select: { module: true },
                        }),
                        prisma.rolePermission.findMany({
                            where: { roleId: user.roleId, OR: anyEnabled },
                            select: { module: true },
                        }).catch(() => [] as { module: string }[]),
                    ])
                    const moduleSet = new Set([
                        ...userPerms.map((p) => p.module),
                        ...rolePerms.map((p) => p.module),
                    ])
                    permissions = Array.from(moduleSet)
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
                // On subsequent requests, refresh effective permissions (role + user union)
                try {
                    const anyEnabled = [
                        { canView: true }, { canCreate: true }, { canUpdate: true },
                        { canDelete: true }, { canRequisition: true },
                    ]
                    const user = await prisma.user.findUnique({
                        where: { id: token.id as string },
                        select: { roleId: true },
                    })
                    const [userPerms, rolePerms] = await Promise.all([
                        prisma.userPermission.findMany({
                            where: { userId: token.id as string, OR: anyEnabled },
                            select: { module: true },
                        }),
                        user?.roleId
                            ? prisma.rolePermission.findMany({
                                  where: { roleId: user.roleId, OR: anyEnabled },
                                  select: { module: true },
                              })
                            : Promise.resolve([] as { module: string }[]),
                    ])
                    const moduleSet = new Set([
                        ...userPerms.map((p) => p.module),
                        ...rolePerms.map((p) => p.module),
                    ])
                    token.permissions = Array.from(moduleSet)
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

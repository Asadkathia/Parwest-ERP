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

                // Load permissions so they're stored in the JWT token.
                // Only include modules where at least one permission is enabled.
                let permissions: string[] = []
                try {
                    const perms = await prisma.userPermission.findMany({
                        where: {
                            userId: user.id,
                            OR: [
                                { canView: true },
                                { canCreate: true },
                                { canUpdate: true },
                                { canDelete: true },
                                { canRequisition: true },
                            ],
                        },
                        select: { module: true },
                    })
                    permissions = perms.map((p) => p.module)
                } catch {
                    permissions = []
                }

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
                // On subsequent requests, refresh permissions from DB so changes
                // take effect without requiring the user to re-login.
                // Only include modules where at least one permission is enabled.
                try {
                    const perms = await prisma.userPermission.findMany({
                        where: {
                            userId: token.id as string,
                            OR: [
                                { canView: true },
                                { canCreate: true },
                                { canUpdate: true },
                                { canDelete: true },
                                { canRequisition: true },
                            ],
                        },
                        select: { module: true },
                    })
                    token.permissions = perms.map((p) => p.module)
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

import NextAuth from "next-auth"
import type { Adapter } from "next-auth/adapters"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"

const authSecret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV !== "production"
        ? "parwest-local-dev-secret-change-me"
        : undefined)

if (!authSecret && process.env.NODE_ENV === "production") {
    throw new Error("Missing AUTH_SECRET/NEXTAUTH_SECRET for NextAuth in production.")
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    adapter: PrismaAdapter(prisma) as Adapter,
    secret: authSecret,
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/login",
    },
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

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role.name,
                    regionId: user.regionId,
                    regionalOfficeId: user.regionalOfficeId,
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.role = user.role
                token.regionId = (user as { regionId?: string | null }).regionId || null
                token.regionalOfficeId = (user as { regionalOfficeId?: string | null }).regionalOfficeId || null
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string
                session.user.role = token.role as string
                ;(session.user as { regionId?: string | null }).regionId = (token.regionId as string | null) || null
                ;(session.user as { regionalOfficeId?: string | null }).regionalOfficeId = (token.regionalOfficeId as string | null) || null
            }
            return session
        },
    },
})

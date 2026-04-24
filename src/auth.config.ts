import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"

const authSecret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV !== "production"
        ? "parwest-local-dev-secret-change-me"
        : undefined)

/**
 * Edge-compatible auth config — no Prisma/Node.js-only imports.
 * Used by middleware.ts for JWT decoding + route protection.
 * The full config (with PrismaAdapter + real authorize) is in src/lib/auth.ts.
 */
export const authConfig = {
    secret: authSecret,
    session: {
        strategy: "jwt" as const,
        maxAge: 60 * 60 * 8,
        updateAge: 60 * 60,
    },
    pages: { signIn: "/login" },
    providers: [
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            // Real authorize is in src/lib/auth.ts — this is a placeholder for edge
            async authorize() {
                return null
            },
        }),
    ],
    callbacks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jwt({ token, user }: { token: any; user?: any }) {
            if (user) {
                token.id = user.id
                token.role = user.role
                token.roleScopeType = user.roleScopeType
                token.regionId = user.regionId ?? null
                token.regionalOfficeId = user.regionalOfficeId ?? null
                token.permissions = user.permissions ?? []
            }
            return token
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        session({ session, token }: { session: any; token: any }) {
            if (session.user) {
                session.user.id = token.id as string
                session.user.role = token.role as string
                session.user.roleScopeType = token.roleScopeType as "GLOBAL" | "REGIONAL" | undefined
                session.user.regionId = (token.regionId as string | null) ?? null
                session.user.regionalOfficeId = (token.regionalOfficeId as string | null) ?? null
                session.user.permissions = (token.permissions as string[]) ?? []
            }
            return session
        },
    },
} satisfies NextAuthConfig
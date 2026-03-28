import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

const authSecret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV !== "production"
        ? "parwest-local-dev-secret-change-me"
        : undefined)

/**
 * Route → required permission module.
 * Admin role bypasses all checks.
 */
const MODULE_ROUTES: [string, string][] = [
    ["/guards", "GUARDS"],
    ["/payroll", "PAYROLL"],
    ["/clients", "CLIENTS"],
    ["/store-inventory", "INVENTORY"],
    ["/users", "USERS"],
    ["/tickets", "TICKETING"],
    ["/settings", "SETTINGS"],
    ["/reports", "REPORTS"],
    ["/imports", "IMPORTS"],
    ["/requisitions", "REQUISITIONS"],
    ["/audit", "AUDIT"],
]

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl

    // Read the JWT token — unauthenticated or token-read errors just pass through.
    // DashboardLayout already redirects unauthenticated users to /login.
    // Middleware ONLY enforces module-level permissions for authenticated users.
    let token: Awaited<ReturnType<typeof getToken>> = null
    try {
        token = await getToken({ req, secret: authSecret })
    } catch {
        return NextResponse.next()
    }

    // Not authenticated → let the page/layout handle it (no middleware redirect)
    if (!token) return NextResponse.next()

    const userRole = token.role as string | undefined
    const permissions = (token.permissions as string[] | undefined) ?? []

    // SuperAdmin bypass:
    // An "Admin" role user with NO permissions assigned = unrestricted SuperAdmin.
    // An "Admin" role user WITH permissions assigned = regional admin, respect their permissions.
    if (userRole === "Admin" && permissions.length === 0) return NextResponse.next()

    // For all other users (including Admin role with specific permissions): enforce module permissions

    for (const [route, module] of MODULE_ROUTES) {
        if (pathname.startsWith(route)) {
            if (!permissions.includes(module)) {
                return NextResponse.redirect(
                    new URL("/dashboard?error=forbidden", req.url)
                )
            }
            break
        }
    }

    return NextResponse.next()
}

export const config = {
    // Only run on dashboard-level routes, skip everything else
    matcher: [
        "/guards/:path*",
        "/payroll/:path*",
        "/clients/:path*",
        "/store-inventory/:path*",
        "/users/:path*",
        "/tickets/:path*",
        "/settings/:path*",
        "/reports/:path*",
        "/imports",
        "/requisitions",
        "/audit",
        "/dashboard/:path*",
    ],
}
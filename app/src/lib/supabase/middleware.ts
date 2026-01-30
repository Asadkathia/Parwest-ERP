import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh session if expired - required for Server Components
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Define public routes that don't require authentication
    const publicRoutes = ['/login', '/forgot-password', '/reset-password', '/auth/callback'];
    const isPublicRoute = publicRoutes.some(route =>
        request.nextUrl.pathname.startsWith(route)
    );

    // Redirect unauthenticated users to login
    const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true';

    if (!user && !isPublicRoute && !isTestMode) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // Redirect authenticated users away from auth pages
    if (user && isPublicRoute && request.nextUrl.pathname !== '/auth/callback') {
        const url = request.nextUrl.clone();

        // Role-based redirect using mock role from localStorage
        // TODO: Get user role from Supabase profile in Phase 8
        const { getRoleDashboardRoute } = await import('@/lib/permissions');
        url.pathname = getRoleDashboardRoute();
        return NextResponse.redirect(url);
    }

    // Role-based dashboard redirect (when accessing root)
    if (user && request.nextUrl.pathname === '/') {
        const url = request.nextUrl.clone();
        const { getRoleDashboardRoute } = await import('@/lib/permissions');
        url.pathname = getRoleDashboardRoute();
        return NextResponse.redirect(url);
    }

    // Role-based dashboard redirect (when accessing root)
    if (user && request.nextUrl.pathname === '/') {
        const url = request.nextUrl.clone();
        // TODO: Implement getRoleDashboardRoute() with user profile data in Phase 8
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
    }


    return supabaseResponse;
}

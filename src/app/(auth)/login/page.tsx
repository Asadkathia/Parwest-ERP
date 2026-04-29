"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { authenticate } from "./actions"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSession } from "next-auth/react"

function SubmitButton() {
    const { pending } = useFormStatus()

    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {pending ? "Signing in..." : "Sign In"}
        </button>
    )
}

export default function LoginPage() {
    const router = useRouter()
    const [errorMessage, dispatch] = useActionState(authenticate, undefined)

    useEffect(() => {
        if (errorMessage !== "success") return
        let cancelled = false
        // Server action set the session cookie via signIn(redirect:false), but the
        // client SessionProvider still holds the pre-login (null) session. Force a
        // refetch of /api/auth/session BEFORE navigating so <AppSidebar> renders
        // with permissions on first paint instead of an empty skeleton until the
        // user manually refreshes (Ticket 25).
        ;(async () => {
            try {
                await getSession()
            } catch {
                // If the session fetch fails for any reason, fall through —
                // router.refresh() below still revalidates server components,
                // and SessionProvider will eventually catch up on its own poll.
            }
            if (cancelled) return
            router.replace("/dashboard")
            router.refresh()
        })()
        return () => {
            cancelled = true
        }
    }, [errorMessage, router])

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="w-full max-w-md space-y-8 px-4">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">Parwest ERP</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Guard Management System
                    </p>
                </div>

                <div className="rounded-lg border bg-card p-8 shadow-sm">
                    <h2 className="text-2xl font-semibold mb-6">Sign in to your account</h2>

                    <form action={dispatch} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium mb-2">
                                Email
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="admin@parwestgroup.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium mb-2">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="••••••••"
                            />
                        </div>

                        {errorMessage && errorMessage !== "success" && (
                            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                                {errorMessage}
                            </div>
                        )}

                        <SubmitButton />
                    </form>
                </div>

                <p className="text-center text-sm text-muted-foreground">
                    Contact your administrator for access
                </p>
            </div>
        </div>
    )
}

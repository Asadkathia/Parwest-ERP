"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { Lock } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/shadcn/tooltip"

type SessionUser = {
  role?: string
  permissions?: string[]
} | undefined

function getUser(session: ReturnType<typeof useSession>["data"]): SessionUser {
  return session?.user as SessionUser
}

function isSessionSuperAdmin(user: SessionUser): boolean {
  if (!user) return false
  if (user.role === "Super User") return true
  return user.role === "Admin" && (user.permissions?.length ?? 0) === 0
}

function permKey(module: string, action: string): string {
  return `${module.toUpperCase()}:${action.toUpperCase()}`
}

/**
 * Mirror of `hasAction()` semantics from `src/lib/api/permissions.ts`,
 * adapted for the client-side `useSession()` shape.
 *
 * - Super User → always true.
 * - Admin with no permissions → always true (SuperAdmin equivalent).
 * - Admin with permissions → strict `MODULE:ACTION` match (no module-only
 *   fallback). When `action` is omitted, falls back to module-level access.
 */
function computeAllowed(
  user: SessionUser,
  module: string,
  action?: string
): boolean {
  if (!user) return false
  if (isSessionSuperAdmin(user)) return true
  const perms = user.permissions ?? []
  if (!action) {
    return perms.includes(module.toUpperCase())
  }
  return perms.includes(permKey(module, action))
}

export interface PermissionGateProps {
  /** Module key, e.g. `"GUARDS"`. */
  module: string
  /** Action key, e.g. `"CREATE"`. Omit for a module-level coarse gate. */
  action?: string
  /** Rendered when the user is allowed. */
  children: React.ReactNode
  /** Custom denied UI. Defaults to a compact `<Alert>`. */
  fallback?: React.ReactNode
  /**
   * - `"hide"`: render nothing on deny.
   * - `"disable"`: clone the first child, mark it `disabled`, wrap in tooltip.
   * - `"message"` (default): render an `<Alert>` with explanatory copy.
   */
  mode?: "hide" | "disable" | "message"
  /** Optional className applied to the default Alert fallback. */
  className?: string
}

/**
 * Client-side permission gate.
 *
 * Reads the session via `useSession()` and decides whether to render the
 * children, hide them, render them disabled, or show a denied message.
 * See `useCanAccess` for the imperative variant.
 */
export function PermissionGate({
  module,
  action,
  children,
  fallback,
  mode = "message",
  className,
}: PermissionGateProps) {
  const { data: session, status } = useSession()

  // While loading, behave conservatively: render nothing rather than flash
  // the denied state. Pages that want a skeleton should wrap their own.
  if (status === "loading") {
    return null
  }

  const user = getUser(session)
  const allowed = computeAllowed(user, module, action)

  if (allowed) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  if (mode === "hide") {
    return null
  }

  const message = `You don't have access to ${module}`

  if (mode === "disable") {
    // Clone the first React element child and mark it disabled. Anything
    // beyond the first child is left as-is and rendered alongside.
    const childArray = React.Children.toArray(children)
    const firstIdx = childArray.findIndex((c) => React.isValidElement(c))

    if (firstIdx === -1) {
      // No element child to clone — fall back to message mode.
      return (
        <DefaultDeniedAlert module={module} className={className} />
      )
    }

    const firstEl = childArray[firstIdx] as React.ReactElement<
      Record<string, unknown>
    >
    const cloned = React.cloneElement(firstEl, {
      ...(firstEl.props as Record<string, unknown>),
      disabled: true,
      "aria-disabled": true,
      title: `${message}.`,
    })

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex" tabIndex={0}>
            {cloned}
          </span>
        </TooltipTrigger>
        <TooltipContent>{message}.</TooltipContent>
      </Tooltip>
    )
  }

  // mode === "message"
  return <DefaultDeniedAlert module={module} className={className} />
}

function DefaultDeniedAlert({
  module,
  className,
}: {
  module: string
  className?: string
}) {
  return (
    <Alert className={className}>
      <Lock className="h-4 w-4" aria-hidden />
      <AlertTitle>Access denied</AlertTitle>
      <AlertDescription>
        You don&apos;t have access to {module}. Ask your administrator.
      </AlertDescription>
    </Alert>
  )
}

/**
 * Imperative companion hook — returns whether the current session is allowed
 * to perform `MODULE:ACTION` (or just `MODULE` when `action` is omitted).
 *
 * Mirrors `hasAction()` semantics from `src/lib/api/permissions.ts`.
 */
export function useCanAccess(module: string, action?: string): boolean {
  const { data: session, status } = useSession()
  if (status === "loading") return false
  return computeAllowed(getUser(session), module, action)
}

export default PermissionGate

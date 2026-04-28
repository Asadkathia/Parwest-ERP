"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Lock } from "lucide-react"

import { Button } from "@/components/shadcn/button"

export interface ForbiddenPageProps {
  /** Module the user tried to reach (e.g. "Payroll"). */
  module?: string
  /** Optional override for the description. Replaces the default copy. */
  description?: string
  /** Trailing line under the description. */
  contactLine?: string
}

/**
 * Full-page 403 state.
 *
 * Used when the entire route is unreachable for the current user. For inline
 * (in-page) denied states, prefer `<PermissionGate>` or its default Alert.
 */
export function ForbiddenPage({
  module,
  description,
  contactLine = "Ask your administrator to grant access.",
}: ForbiddenPageProps): React.ReactElement {
  const router = useRouter()

  const resolvedDescription =
    description ??
    (module
      ? `You don't have access to ${module}.`
      : "You don't have access to this area.")

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center px-6 py-12">
      <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-muted">
          <Lock className="h-7 w-7 text-muted-foreground" aria-hidden />
        </div>
        <div
          aria-hidden
          className="font-mono font-bold leading-none text-muted-foreground"
          style={{ fontSize: "var(--text-32, 2rem)" }}
        >
          403
        </div>
        <h1
          className="mt-3 font-bold tracking-tight"
          style={{ fontSize: "var(--text-24, 1.5rem)" }}
        >
          Access denied
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {resolvedDescription}
        </p>
        {contactLine ? (
          <p className="mt-1 text-sm text-muted-foreground">{contactLine}</p>
        ) : null}
        <div className="mt-6 flex items-center gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Go back
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ForbiddenPage

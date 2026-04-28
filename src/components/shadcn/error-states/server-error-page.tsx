"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ServerCrash } from "lucide-react"

import { Button } from "@/components/shadcn/button"

export interface ServerErrorPageProps {
  /**
   * The verbatim message from the API error envelope. Falls back to a generic
   * line. Do not paraphrase or soften — show as received.
   */
  message?: string
  /** Reference code from the API envelope. Rendered as a monospaced chip. */
  code?: string
  /** Retry handler. When provided, shows a "Retry" button. */
  onRetry?: () => void
}

/**
 * Full-page 500 state.
 *
 * Wired into `app/(dashboard)/error.tsx`. The `message` prop is taken from
 * the thrown `Error.message` (or API envelope `message` field) and shown
 * verbatim per voice rules.
 */
export function ServerErrorPage({
  message = "Something went wrong on our end.",
  code,
  onRetry,
}: ServerErrorPageProps): React.ReactElement {
  const router = useRouter()

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center px-6 py-12">
      <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-destructive/10">
          <ServerCrash className="h-7 w-7 text-destructive" aria-hidden />
        </div>
        <div
          aria-hidden
          className="font-mono font-bold leading-none text-destructive"
          style={{ fontSize: "var(--text-32, 2rem)" }}
        >
          500
        </div>
        <h1
          className="mt-3 font-bold tracking-tight"
          style={{ fontSize: "var(--text-24, 1.5rem)" }}
        >
          Server error
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {message}
        </p>
        {code ? (
          <code className="mt-3 inline-flex items-center rounded-sm bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
            ref: {code}
          </code>
        ) : null}
        <div className="mt-6 flex items-center gap-2">
          {onRetry ? (
            <Button onClick={onRetry}>Retry</Button>
          ) : null}
          <Button variant="outline" onClick={() => router.refresh()}>
            Reload
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ServerErrorPage

"use client"

import * as React from "react"

import { ServerErrorPage } from "@/components/shadcn/error-states"

interface ErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Dashboard-group error boundary. Catches uncaught render/data errors from
 * any nested route. Shows the verbatim error message and exposes the Next.js
 * `reset` callback as the Retry handler.
 */
export default function DashboardError({
  error,
  reset,
}: ErrorBoundaryProps): React.ReactElement {
  return <ServerErrorPage message={error.message} code={error.digest} onRetry={reset} />
}

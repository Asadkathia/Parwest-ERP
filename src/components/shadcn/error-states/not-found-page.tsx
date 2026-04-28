"use client"

import * as React from "react"
import Link from "next/link"
import { FileQuestion } from "lucide-react"

import { Button } from "@/components/shadcn/button"

export interface NotFoundPageProps {
  /** Heading. Defaults to "Page not found". */
  title?: string
  /** Sub-copy under the heading. */
  description?: string
  /** Label for the primary CTA. */
  ctaLabel?: string
  /** Where the primary CTA links to. */
  ctaHref?: string
}

/**
 * Full-page 404 state.
 *
 * Centered layout with a large `404` numeral, an icon, a title, descriptive
 * copy, and a primary CTA. Used by `app/(dashboard)/not-found.tsx` and
 * anywhere a route renders a missing resource.
 */
export function NotFoundPage({
  title = "Page not found",
  description = "The page you're looking for doesn't exist or has been moved.",
  ctaLabel = "Back to dashboard",
  ctaHref = "/dashboard",
}: NotFoundPageProps): React.ReactElement {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center px-6 py-12">
      <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-muted">
          <FileQuestion className="h-7 w-7 text-muted-foreground" aria-hidden />
        </div>
        <div
          aria-hidden
          className="font-mono font-bold leading-none text-muted-foreground"
          style={{ fontSize: "var(--text-32, 2rem)" }}
        >
          404
        </div>
        <h1
          className="mt-3 font-bold tracking-tight"
          style={{ fontSize: "var(--text-24, 1.5rem)" }}
        >
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <div className="mt-6 flex items-center gap-2">
          <Button asChild>
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage

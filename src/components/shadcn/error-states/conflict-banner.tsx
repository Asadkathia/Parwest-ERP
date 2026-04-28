"use client"

import * as React from "react"
import Link from "next/link"
import { AlertCircle } from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/shadcn/alert"
import { cn } from "@/lib/utils"

export interface ConflictBannerProps {
  /** Field name that triggered the conflict (e.g. "CNIC", "Parwest ID"). */
  field: string
  /** The duplicate value the user submitted. */
  value: string
  /** Optional link to the existing record. Renders a "View existing record" link. */
  existingHref?: string
  /** Optional className passed through to the underlying Alert. */
  className?: string
}

/**
 * Inline 409 conflict banner — destructive Alert intended to live inside a
 * form, not as a full-page state. Pairs with field-level `FormMessage` errors.
 */
export function ConflictBanner({
  field,
  value,
  existingHref,
  className,
}: ConflictBannerProps): React.ReactElement {
  return (
    <Alert variant="destructive" className={cn(className)}>
      <AlertCircle className="h-4 w-4" aria-hidden />
      <AlertTitle>{field} already exists</AlertTitle>
      <AlertDescription>
        Another record uses{" "}
        <code className="font-mono text-xs">{value}</code>.
        {existingHref ? (
          <>
            {" "}
            <Link
              href={existingHref}
              className="font-semibold underline underline-offset-2"
            >
              View existing record
            </Link>
          </>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

export default ConflictBanner

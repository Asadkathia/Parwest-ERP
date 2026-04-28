"use client"

import { useState } from "react"
import Link from "next/link"
import { Info, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert"

export type IncompleteCategory = {
    /** Short chip label shown to the user. */
    label: string
    /** Tab id (matches GuardProfileTabs URL contract: ?tab=<id>). */
    tabId: string
    /** Optional override href — used when the field lives on the edit form (e.g. `/guards/[id]/edit#family-members`). */
    href?: string
}

interface ProfileIncompleteBannerProps {
    guardId: string
    /** Ordered list of missing categories. First entry drives the action button target. */
    missing: IncompleteCategory[]
}

/**
 * Phase 3 cleanup: alerts users that fields dropped from the 6-step quick-create
 * wizard are still missing. Points to the legacy tab where each can be edited.
 *
 * Dismissal is session-local (component state) — no persistence. The banner
 * reappears on the next page load until the underlying data is filled in.
 */
export default function ProfileIncompleteBanner({
    guardId,
    missing,
}: ProfileIncompleteBannerProps) {
    const [dismissed, setDismissed] = useState(false)

    if (dismissed || missing.length === 0) return null

    const first = missing[0]
    const actionHref = first.href ?? `/guards/${guardId}?tab=${first.tabId}`
    const actionLabel = `Open ${first.label}`

    return (
        <Alert variant="default" className="border-blue-200 bg-blue-50 text-blue-900">
            <Info className="h-4 w-4 text-blue-600" />
            <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setDismissed(true)}
                className="absolute right-3 top-3 rounded-md p-1 text-blue-700/70 hover:bg-blue-100 hover:text-blue-900 transition-colors"
            >
                <X className="h-4 w-4" />
            </button>
            <AlertTitle className="text-blue-900">Profile incomplete</AlertTitle>
            <AlertDescription className="text-blue-900/90">
                <p>
                    Some details from this guard&apos;s record are missing — they were
                    not collected during quick-create. Add the missing info to enable
                    deployments and payroll.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {missing.map((c) => (
                        <span
                            key={c.tabId + c.label}
                            className="inline-flex items-center rounded-full border border-blue-300 bg-white px-2.5 py-0.5 text-xs font-medium text-blue-800"
                        >
                            {c.label}
                        </span>
                    ))}
                </div>
                <div className="mt-4">
                    <Link
                        href={actionHref}
                        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                    >
                        {actionLabel}
                    </Link>
                </div>
            </AlertDescription>
        </Alert>
    )
}

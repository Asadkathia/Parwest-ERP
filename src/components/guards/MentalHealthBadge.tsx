"use client"

import { useState, useEffect, useCallback } from "react"
import { Brain, ShieldCheck, ShieldX, Clock } from "lucide-react"

const MENTAL_HEALTH_DOC = "Mental Health Verification Form"

type Status = "verified" | "expired" | "pending" | "not_uploaded"

interface MentalHealthBadgeProps {
  guardId: string
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" })
}

export default function MentalHealthBadge({ guardId }: MentalHealthBadgeProps) {
  const [status, setStatus] = useState<Status>("not_uploaded")
  const [expiry, setExpiry] = useState<string | null>(null)
  const [expiryRaw, setExpiryRaw] = useState<Date | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)

  const load = useCallback(() => {
    fetch(`/api/guards/${guardId}/prerequisites`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Array<Record<string, unknown>>) => {
        const row = data.find((d) => d.docTypeName === MENTAL_HEALTH_DOC)
        if (!row) { setStatus("not_uploaded"); return }

        const hasFile = !!(row.attachmentData || row.documentUrl)
        if (!hasFile) { setStatus("not_uploaded"); return }

        let expiryDate: Date | null = null
        if (row.expiryDate) {
          expiryDate = new Date(row.expiryDate as string)
          setExpiryRaw(expiryDate)
          setExpiry(formatDate(row.expiryDate as string))
          if (expiryDate < new Date()) {
            setStatus("expired")
            return
          }
        }

        if (row.verificationStatus === "VERIFIED" || row.status === "VERIFIED") {
          setStatus("verified")
        } else {
          setStatus("pending")
        }
      })
      .catch(() => setStatus("not_uploaded"))
  }, [guardId])

  useEffect(() => { load() }, [load])

  const config: Record<Status, {
    Icon: React.ElementType
    color: string
    bg: string
    border: string
    label: string
  }> = {
    verified: {
      Icon: ShieldCheck,
      color: "text-green-700",
      bg: "bg-green-50",
      border: "border-green-200",
      label: "Mental Health Verified",
    },
    expired: {
      Icon: ShieldX,
      color: "text-red-700",
      bg: "bg-red-50",
      border: "border-red-200",
      label: "Mental Health Expired",
    },
    pending: {
      Icon: Clock,
      color: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-200",
      label: "Mental Health Pending",
    },
    not_uploaded: {
      Icon: Brain,
      color: "text-gray-400",
      bg: "bg-gray-50",
      border: "border-gray-200",
      label: "Mental Health — Not Submitted",
    },
  }

  const { Icon, color, bg, border, label } = config[status]

  const daysUntilExpiry = expiryRaw
    ? Math.ceil((expiryRaw.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Badge */}
      <span
        className={`inline-flex cursor-default items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${bg} ${border} ${color}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2.5 text-xs text-white shadow-xl pointer-events-none">
          <p className="font-semibold">{label}</p>
          {expiry ? (
            <>
              <p className="mt-1 text-gray-300">
                Expires: <span className={status === "expired" ? "text-red-400 font-semibold" : "text-white"}>{expiry}</span>
              </p>
              {daysUntilExpiry !== null && daysUntilExpiry > 0 && (
                <p className="text-gray-400">In {daysUntilExpiry} day{daysUntilExpiry !== 1 ? "s" : ""}</p>
              )}
              {daysUntilExpiry !== null && daysUntilExpiry <= 0 && (
                <p className="text-red-400">Expired {Math.abs(daysUntilExpiry)} day{Math.abs(daysUntilExpiry) !== 1 ? "s" : ""} ago</p>
              )}
            </>
          ) : (
            <p className="mt-1 text-gray-400">No expiry date set</p>
          )}
          {/* Arrow */}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  )
}

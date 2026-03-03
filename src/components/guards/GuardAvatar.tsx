"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { UserCircle2 } from "lucide-react"

type Props = {
  guardId: string
  guardName: string
  initialUrl?: string | null
  size?: "sm" | "md"
}

const initialsFrom = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")

export default function GuardAvatar({ guardId, guardName, initialUrl, size = "sm" }: Props) {
  const storageKey = `guard-profile-image:${guardId}`
  const [preview] = useState<string | null>(() => {
    if (typeof window === "undefined") return initialUrl || null
    return localStorage.getItem(storageKey) || initialUrl || null
  })
  const initials = useMemo(() => initialsFrom(guardName), [guardName])

  const sizeClasses = size === "md" ? "h-12 w-12" : "h-10 w-10"
  const iconClasses = size === "md" ? "h-5 w-5" : "h-4 w-4"
  const labelClasses = size === "md" ? "text-[9px]" : "text-[8px]"

  if (preview) {
    return (
      <Image
        src={preview}
        alt={guardName}
        width={size === "md" ? 48 : 40}
        height={size === "md" ? 48 : 40}
        unoptimized
        className={`${sizeClasses} rounded-full object-cover border border-[var(--border)]`}
      />
    )
  }

  return (
    <div className={`${sizeClasses} rounded-full bg-[var(--surface-muted)] border border-[var(--border)] flex flex-col items-center justify-center text-[var(--text-muted)]`}>
      <UserCircle2 className={`${iconClasses} opacity-70`} />
      <span className={`${labelClasses} font-medium leading-none mt-0.5`}>No photo</span>
      <span className={`${labelClasses} font-semibold leading-none mt-0.5`}>{initials || "GU"}</span>
    </div>
  )
}

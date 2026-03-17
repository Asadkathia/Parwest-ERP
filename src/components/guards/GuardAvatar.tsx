"use client"

import { useEffect, useMemo, useState } from "react"
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
  const [preview, setPreview] = useState<string | null>(initialUrl || null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    // If DB has a URL, always use it and keep localStorage in sync
    if (initialUrl) {
      const rafId = requestAnimationFrame(() => setPreview(initialUrl))
      localStorage.setItem(storageKey, initialUrl)
      return () => cancelAnimationFrame(rafId)
    }
    // Fall back to localStorage for offline / cached display
    const stored = localStorage.getItem(storageKey)
    if (!stored) return
    const rafId = requestAnimationFrame(() => setPreview(stored))
    return () => cancelAnimationFrame(rafId)
  }, [storageKey, initialUrl])
  const initials = useMemo(() => initialsFrom(guardName), [guardName])

  const sizeClasses = size === "md" ? "h-12 w-12" : "h-10 w-10"
  const iconClasses = size === "md" ? "h-5 w-5" : "h-4 w-4"
  const labelClasses = size === "md" ? "text-[9px]" : "text-[8px]"

  const popup = hovered ? (
    <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 flex flex-row items-center">
      <div className="mr-[-1px] h-2.5 w-2 overflow-hidden flex items-center">
        <div className="h-3 w-3 rotate-45 border-l border-t border-[var(--border)] bg-white" />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-white shadow-xl p-1.5">
        {preview ? (
          <Image
            src={preview}
            alt={guardName}
            width={120}
            height={120}
            unoptimized
            className="h-[120px] w-[120px] rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-[120px] w-[120px] flex-col items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--text-muted)]">
            <UserCircle2 className="h-10 w-10 opacity-50" />
            <span className="mt-1 text-[10px] font-semibold">{initials || "GU"}</span>
          </div>
        )}
        <p className="mt-1 max-w-[120px] truncate text-center text-[10px] font-medium text-[var(--text)]">{guardName}</p>
      </div>
    </div>
  ) : null

  if (preview) {
    return (
      <div
        className="relative inline-block cursor-pointer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {popup}
        <Image
          src={preview}
          alt={guardName}
          width={size === "md" ? 48 : 40}
          height={size === "md" ? 48 : 40}
          unoptimized
          className={`${sizeClasses} rounded-full object-cover border border-[var(--border)]`}
        />
      </div>
    )
  }

  return (
    <div
      className="relative inline-block cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {popup}
      <div className={`${sizeClasses} rounded-full bg-[var(--surface-muted)] border border-[var(--border)] flex flex-col items-center justify-center text-[var(--text-muted)]`}>
        <UserCircle2 className={`${iconClasses} opacity-70`} />
        <span className={`${labelClasses} font-medium leading-none mt-0.5`}>No photo</span>
        <span className={`${labelClasses} font-semibold leading-none mt-0.5`}>{initials || "GU"}</span>
      </div>
    </div>
  )
}

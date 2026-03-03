"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { UserCircle2 } from "lucide-react"

type Props = {
  guardId: string
  guardName: string
  initialUrl?: string | null
}

const initialsFrom = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")

export default function ProfileImageCard({ guardId, guardName, initialUrl }: Props) {
  const storageKey = `guard-profile-image:${guardId}`
  const [preview, setPreview] = useState<string | null>(() => {
    if (typeof window === "undefined") return initialUrl || null
    return localStorage.getItem(storageKey) || initialUrl || null
  })

  const initials = useMemo(() => initialsFrom(guardName), [guardName])

  const onFileChange = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : null
      setPreview(value)
      if (value) localStorage.setItem(storageKey, value)
    }
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setPreview(null)
    if (typeof window !== "undefined") localStorage.removeItem(storageKey)
  }

  return (
    <div className="ui-card p-4">
      <p className="text-sm font-semibold text-[var(--text)] mb-3">Profile Picture</p>
      <div className="flex items-center gap-4">
        {preview ? (
          <Image
            src={preview}
            alt={guardName}
            width={80}
            height={80}
            unoptimized
            className="h-20 w-20 rounded-full object-cover border border-[var(--border)]"
          />
        ) : (
          <div className="h-20 w-20 rounded-full bg-[var(--surface-muted)] border border-[var(--border)] flex flex-col items-center justify-center text-[var(--text-muted)]">
            <UserCircle2 className="h-8 w-8 opacity-70" />
            <span className="text-[10px] font-medium leading-none mt-1">No photo</span>
            <span className="text-[10px] font-semibold leading-none mt-0.5">{initials || "GU"}</span>
          </div>
        )}
        <div className="space-y-2">
          <label className="ui-btn ui-btn-secondary px-3 py-1.5 text-sm cursor-pointer inline-flex">
            Upload / Change
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onFileChange(e.target.files?.[0] || null)} />
          </label>
          <div>
            <button type="button" onClick={removeImage} className="text-xs text-red-600 hover:underline">Remove</button>
          </div>
        </div>
      </div>
    </div>
  )
}

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

async function savePhotoToDb(guardId: string, photoUrl: string | null) {
  await fetch(`/api/guards/${guardId}/photo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photoUrl }),
  })
}

export default function ProfileImageCard({ guardId, guardName, initialUrl }: Props) {
  const storageKey = `guard-profile-image:${guardId}`
  const [preview, setPreview] = useState<string | null>(() => {
    // DB value takes priority over stale localStorage
    if (initialUrl) return initialUrl
    if (typeof window === "undefined") return null
    return localStorage.getItem(storageKey) || null
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  const initials = useMemo(() => initialsFrom(guardName), [guardName])

  const onFileChange = (file: File | null) => {
    if (!file) return
    setSaveError("")
    const reader = new FileReader()
    reader.onload = async () => {
      const value = typeof reader.result === "string" ? reader.result : null
      if (!value) return
      setPreview(value)
      localStorage.setItem(storageKey, value)
      setSaving(true)
      try {
        const res = await fetch(`/api/guards/${guardId}/photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoUrl: value }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          setSaveError(err.message || "Failed to save photo")
        }
      } catch {
        setSaveError("Network error — photo saved locally only")
      } finally {
        setSaving(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const removeImage = async () => {
    setPreview(null)
    setSaveError("")
    if (typeof window !== "undefined") localStorage.removeItem(storageKey)
    setSaving(true)
    try {
      await savePhotoToDb(guardId, null)
    } catch {
      // silent — DB will sync on next save
    } finally {
      setSaving(false)
    }
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
          <label className="ui-btn ui-btn-secondary px-3 py-1.5 text-sm cursor-pointer inline-flex items-center gap-1.5">
            {saving ? "Saving…" : "Upload / Change"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={saving}
              onChange={(e) => onFileChange(e.target.files?.[0] || null)}
            />
          </label>
          <div>
            <button
              type="button"
              onClick={removeImage}
              disabled={saving}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          </div>
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
          {saving && <p className="text-xs text-gray-400">Saving to database…</p>}
        </div>
      </div>
    </div>
  )
}

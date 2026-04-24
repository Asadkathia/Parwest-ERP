"use client"

import { useMemo, useState, useEffect } from "react"
import Image from "next/image"
import { UserCircle2, X } from "lucide-react"
import { removeCachedGuardImageUrl } from "@/lib/guardImageStorage"

type Props = {
  guardId: string
  guardName: string
  initialUrl?: string | null
  canCreate?: boolean
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

export default function ProfileImageCard({ guardId, guardName, initialUrl, canCreate = false }: Props) {
  // DB value is the source of truth; no localStorage fallback here because the
  // payload is a base64 data URL (up to 2 MB) and would blow the storage quota.
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const initials = useMemo(() => initialsFrom(guardName), [guardName])

  // Close lightbox on Escape key
  useEffect(() => {
    if (!lightboxOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxOpen(false) }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [lightboxOpen])

  const onFileChange = (file: File | null) => {
    if (!file) return
    setSaveError("")
    const reader = new FileReader()
    reader.onload = async () => {
      const value = typeof reader.result === "string" ? reader.result : null
      if (!value) return
      // Optimistic preview via React state only — the base64 payload is too
      // large for localStorage (2–3 MB) and would cause QuotaExceededError.
      setPreview(value)
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
        setSaveError("Network error — please retry")
      } finally {
        setSaving(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const removeImage = async () => {
    setPreview(null)
    setSaveError("")
    removeCachedGuardImageUrl(guardId)
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
    <>
      {/* Lightbox modal */}
      {lightboxOpen && preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-w-lg w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg hover:bg-gray-100"
            >
              <X className="h-4 w-4 text-gray-700" />
            </button>
            <Image
              src={preview}
              alt={guardName}
              width={500}
              height={500}
              unoptimized
              className="w-full rounded-xl object-contain shadow-2xl"
            />
            <p className="mt-2 text-center text-sm text-white font-medium">{guardName}</p>
          </div>
        </div>
      )}

    <div className="ui-card p-4">
      <p className="text-sm font-semibold text-[var(--text)] mb-3">Profile Picture</p>
      <div className="flex items-center gap-4">
        {preview ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="focus:outline-none"
            title="Click to enlarge"
          >
            <Image
              src={preview}
              alt={guardName}
              width={80}
              height={80}
              unoptimized
              className="h-20 w-20 rounded-full object-cover border border-[var(--border)] cursor-zoom-in hover:opacity-90 transition-opacity"
            />
          </button>
        ) : (
          <div className="h-20 w-20 rounded-full bg-[var(--surface-muted)] border border-[var(--border)] flex flex-col items-center justify-center text-[var(--text-muted)]">
            <UserCircle2 className="h-8 w-8 opacity-70" />
            <span className="text-[10px] font-medium leading-none mt-1">No photo</span>
            <span className="text-[10px] font-semibold leading-none mt-0.5">{initials || "GU"}</span>
          </div>
        )}
        <div className="space-y-2">
          {canCreate && (
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
          )}
          {canCreate && preview && (
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
          )}
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
          {saving && <p className="text-xs text-gray-400">Saving to database…</p>}
        </div>
      </div>
    </div>
    </>
  )
}

"use client"

import { useState } from "react"
import { fileToBase64, MAX_ORIGINAL_BYTES } from "@/lib/files/base64"

type Props = {
  value: string | null
  onChange: (dataUrl: string | null) => void
  accept?: string
  label?: string
  previewMode?: "image" | "link" | "none"
}

export default function Base64FileUpload({
  value,
  onChange,
  accept = "image/*",
  label = "Upload File",
  previewMode = "image",
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleFile = async (file: File | null) => {
    setError(null)
    if (!file) {
      onChange(null)
      return
    }
    setBusy(true)
    const result = await fileToBase64(file)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onChange(result.dataUrl)
  }

  return (
    <div className="space-y-2">
      <label className="ui-btn ui-btn-secondary px-3 py-2 text-sm cursor-pointer inline-block">
        {busy ? "Reading…" : label}
        <input
          type="file"
          className="hidden"
          accept={accept}
          disabled={busy}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <p className="text-xs text-[var(--text-muted)]">
        Max {Math.round(MAX_ORIGINAL_BYTES / 1024)}KB.
      </p>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {value && previewMode === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="preview" className="max-h-32 rounded border border-[var(--border)]" />
      )}
      {value && previewMode === "link" && (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-[var(--brand)] underline"
        >
          View attachment
        </a>
      )}
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-red-500 hover:underline"
        >
          Remove
        </button>
      )}
    </div>
  )
}

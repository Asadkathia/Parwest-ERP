"use client"

import { useState } from "react"
import ActionButton from "@/components/ui/action-button"
import { OcrExtraction, simulateOcrExtraction } from "@/lib/mockData"

type Props = {
  target: "guard" | "client"
  onApply: (fields: Record<string, string>) => void
}

export default function OcrUploadPanel({ target, onApply }: Props) {
  const [extraction, setExtraction] = useState<OcrExtraction | null>(null)

  const handleFile = (file: File | null) => {
    if (!file) return
    setExtraction(simulateOcrExtraction(file.name, target))
  }

  const apply = () => {
    if (!extraction) return
    const values = Object.fromEntries(extraction.fields.map((field) => [field.field, field.value]))
    onApply(values)
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)]">OCR Autofill</h3>
          <p className="text-xs text-[var(--text-muted)]">Upload document to prefill form fields.</p>
        </div>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => handleFile(e.target.files?.[0] || null)}
          className="block text-xs text-[var(--text-muted)]"
        />
      </div>

      {extraction ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{extraction.documentType}</p>
          <div className="grid gap-2 md:grid-cols-2">
            {extraction.fields.map((field) => (
              <div key={field.field} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
                <p className="font-medium text-[var(--text)]">{field.field}</p>
                <p className="text-[var(--text-muted)]">{field.value}</p>
                <p className="text-xs text-[var(--text-muted)]">Confidence: {Math.round(field.confidence * 100)}%</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <ActionButton onClick={apply}>Apply Fields</ActionButton>
            <ActionButton variant="secondary" onClick={() => setExtraction(null)}>Discard</ActionButton>
          </div>
        </div>
      ) : null}
    </section>
  )
}

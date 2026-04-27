"use client"

import { useEffect, useRef, useState } from "react"

type GuardOption = {
  id: string
  parwestId: string
  name: string
}

type Props = {
  value: string
  onChange: (value: string) => void
  onSelect: (guard: GuardOption) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  /**
   * When set, the autocomplete only searches guards within this region.
   * The `/api/guards` route already enforces REGIONAL scope server-side,
   * but for SuperAdmins this lets the caller pin the search to whatever
   * region the page-level region gate has selected.
   */
  regionId?: string | null
}

export default function GuardAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Parwest ID",
  disabled,
  className,
  regionId = null,
}: Props) {
  const [options, setOptions] = useState<GuardOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!value || value.length < 2) {
      setOptions([])
      setOpen(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ search: value, take: "10" })
        if (regionId) params.set("regionId", regionId)
        const res = await fetch(`/api/guards?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          const rows: GuardOption[] = Array.isArray(data) ? data : data.rows ?? data.guards ?? []
          setOptions(
            rows
              .map((r) => ({ id: r.id, parwestId: r.parwestId, name: r.name }))
              .filter((r) => r.parwestId && r.id)
          )
          setOpen(true)
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, regionId])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <input
        className="ui-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => options.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {open && (options.length > 0 || loading) && (
        <div className="absolute z-10 mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] shadow-lg max-h-60 overflow-auto">
          {loading && options.length === 0 && (
            <div className="px-3 py-2 text-sm text-[var(--text-muted)]">Searching…</div>
          )}
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onSelect(opt)
                setOpen(false)
              }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-muted)] border-b border-[var(--border)] last:border-0"
            >
              <span className="font-mono font-medium">{opt.parwestId}</span>
              <span className="ml-2 text-[var(--text-muted)]">{opt.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, X } from "lucide-react"

export type SearchSelectOption = {
    value: string
    label: string
}

type Props = {
    name: string
    options: SearchSelectOption[]
    placeholder?: string
    defaultValue?: string
    value?: string
    required?: boolean
    disabled?: boolean
    onChange?: (value: string) => void
}

export default function SearchSelect({
    name,
    options,
    placeholder = "Select…",
    defaultValue = "",
    value,
    required = false,
    disabled = false,
    onChange,
}: Props) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [uncontrolledSelected, setUncontrolledSelected] = useState<SearchSelectOption | null>(() =>
        (options ?? []).find((o) => o.value === (value ?? defaultValue)) ?? null
    )
    // When `value` is provided, derive `selected` from props during render (controlled);
    // otherwise fall back to internal state (uncontrolled).
    const selected: SearchSelectOption | null =
        value !== undefined
            ? (options ?? []).find((o) => o.value === value) ?? null
            : uncontrolledSelected
    const setSelected = setUncontrolledSelected
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
                setQuery("")
            }
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    const safeOptions = options ?? []
    const filtered = query.trim()
        ? safeOptions.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
        : safeOptions

    const handleSelect = (opt: SearchSelectOption) => {
        setSelected(opt)
        setOpen(false)
        setQuery("")
        onChange?.(opt.value)
    }

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        setSelected(null)
        setQuery("")
        onChange?.("")
    }

    const handleOpen = () => {
        if (disabled) return
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 0)
    }

    return (
        <div ref={containerRef} className="relative">
            {/* Hidden input for form submission */}
            <input type="hidden" name={name} value={selected?.value ?? ""} required={required} />

            {/* Trigger */}
            <div
                onClick={handleOpen}
                className={`ui-input flex items-center justify-between cursor-pointer gap-2 ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
                {open ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Search…"
                        className="flex-1 bg-transparent outline-none text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]"
                    />
                ) : (
                    <span className={`flex-1 text-sm truncate ${selected ? "text-[var(--text)]" : "text-[var(--text-muted)]"}`}>
                        {selected ? selected.label : placeholder}
                    </span>
                )}
                <div className="flex items-center gap-1 flex-shrink-0">
                    {selected && !open && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-[var(--text-muted)] hover:text-red-500 p-0.5 rounded"
                        >
                            <X size={12} />
                        </button>
                    )}
                    <ChevronDown
                        size={14}
                        className={`text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
                    />
                </div>
            </div>

            {/* Dropdown */}
            {open && (
                <div className="absolute z-[2000] mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-lg max-h-56 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-[var(--text-muted)]">No results</p>
                    ) : (
                        filtered.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleSelect(opt)}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-muted)] transition-colors ${
                                    selected?.value === opt.value
                                        ? "bg-[var(--brand)] text-white hover:bg-[var(--brand)]"
                                        : "text-[var(--text)]"
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}

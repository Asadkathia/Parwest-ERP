"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, X } from "lucide-react"

export type MultiSearchSelectOption = {
    value: string
    label: string
}

type Props = {
    name: string
    options: MultiSearchSelectOption[]
    placeholder?: string
    defaultValues?: string[]
    disabled?: boolean
    onChange?: (values: string[]) => void
}

export default function MultiSearchSelect({
    name,
    options,
    placeholder = "Select…",
    defaultValues = [],
    disabled = false,
    onChange,
}: Props) {
    const safeOptions = options ?? []
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [selected, setSelected] = useState<MultiSearchSelectOption[]>(() =>
        safeOptions.filter((o) => defaultValues.includes(o.value))
    )
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

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

    const filtered = query.trim()
        ? safeOptions.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
        : safeOptions

    const toggle = (opt: MultiSearchSelectOption) => {
        setSelected((prev) => {
            const isSelected = prev.some((o) => o.value === opt.value)
            const next = isSelected ? prev.filter((o) => o.value !== opt.value) : [...prev, opt]
            onChange?.(next.map((o) => o.value))
            return next
        })
    }

    const remove = (value: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setSelected((prev) => {
            const next = prev.filter((o) => o.value !== value)
            onChange?.(next.map((o) => o.value))
            return next
        })
    }

    const handleOpen = () => {
        if (disabled) return
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 0)
    }

    const commaSeparated = selected.map((o) => o.value).join(",")

    return (
        <div ref={containerRef} className="relative">
            {/* Hidden input — comma-separated values for form submission */}
            <input type="hidden" name={name} value={commaSeparated} />

            {/* Trigger */}
            <div
                onClick={handleOpen}
                className={`ui-input min-h-[38px] flex flex-wrap items-center gap-1.5 cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
                {selected.length === 0 && !open && (
                    <span className="text-sm text-[var(--text-muted)] flex-1">{placeholder}</span>
                )}

                {/* Tags */}
                {selected.map((opt) => (
                    <span
                        key={opt.value}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-medium"
                    >
                        {opt.label}
                        <button
                            type="button"
                            onClick={(e) => remove(opt.value, e)}
                            className="hover:text-red-600 rounded-full"
                        >
                            <X size={10} />
                        </button>
                    </span>
                ))}

                {/* Search input — always show when open */}
                {open && (
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Search…"
                        className="flex-1 min-w-[80px] bg-transparent outline-none text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]"
                    />
                )}

                <ChevronDown
                    size={14}
                    className={`ml-auto flex-shrink-0 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
                />
            </div>

            {/* Dropdown */}
            {open && (
                <div className="absolute z-[2000] mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-lg max-h-56 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-[var(--text-muted)]">No results</p>
                    ) : (
                        filtered.map((opt) => {
                            const isSelected = selected.some((o) => o.value === opt.value)
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => toggle(opt)}
                                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[var(--surface-muted)] transition-colors ${
                                        isSelected ? "text-[var(--brand)] font-medium" : "text-[var(--text)]"
                                    }`}
                                >
                                    <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                        isSelected ? "bg-[var(--brand)] border-[var(--brand)]" : "border-gray-300"
                                    }`}>
                                        {isSelected && (
                                            <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 text-white fill-current">
                                                <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        )}
                                    </span>
                                    {opt.label}
                                </button>
                            )
                        })
                    )}
                </div>
            )}
        </div>
    )
}
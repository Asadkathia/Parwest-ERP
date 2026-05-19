"use client"
import { useState } from "react"

export type CellProps = {
  value: unknown
  onCommit: (next: string | null) => void
  invalid?: boolean
  placeholder?: string
  autoFocus?: boolean
}

export function TextCell({ value, onCommit, invalid, placeholder, autoFocus }: CellProps) {
  const external = value == null ? "" : String(value)
  // React's "adjusting state during render" pattern: compare prop snapshot to
  // tracked snapshot and reset local edit buffer when upstream value changes.
  const [snapshot, setSnapshot] = useState(external)
  const [v, setV] = useState(external)
  if (snapshot !== external) {
    setSnapshot(external)
    setV(external)
  }
  return (
    <input
      className={`w-full bg-transparent text-sm outline-none ${invalid ? "text-destructive" : ""}`}
      value={v}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const next = v.trim() === "" ? null : v
        if (next !== (value == null ? null : String(value))) onCommit(next)
      }}
    />
  )
}

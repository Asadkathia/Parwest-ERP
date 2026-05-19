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
      className={
        "h-7 w-full rounded-sm border bg-background px-2 text-sm transition-colors " +
        "hover:border-input focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring " +
        (invalid
          ? "border-destructive bg-destructive/5 text-destructive"
          : "border-input/40 hover:bg-muted/30 focus:bg-background")
      }
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

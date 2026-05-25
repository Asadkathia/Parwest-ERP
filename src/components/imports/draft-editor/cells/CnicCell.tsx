"use client"
import { TextCell, type CellProps } from "./TextCell"

// Auto-insert the CNIC dashes for readability, but do NOT truncate extra
// digits. An over-long / malformed value must stay malformed so the CNIC
// format check flags it, instead of being silently "fixed" into a valid-
// looking (but wrong) number.
function formatCnic(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length <= 5) return digits
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
}

export function CnicCell(props: CellProps) {
  return (
    <TextCell
      {...props}
      placeholder="XXXXX-XXXXXXX-X"
      onCommit={(next) => props.onCommit(next == null ? null : formatCnic(next))}
    />
  )
}

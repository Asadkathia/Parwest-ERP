"use client"
import { TextCell, type CellProps } from "./TextCell"

// Normalise a Pakistani mobile toward the canonical +92-XXX-XXXXXXX shape.
// Strips a country code (0092 / 92) or trunk 0, then groups as +92-<3>-<rest>.
// Like CnicCell, extra digits are NOT truncated — an over-long value stays
// malformed so the PHONE_REGEX check flags it instead of silently "fixing" it.
function formatPhone(raw: string): string {
  let d = raw.replace(/\D/g, "")
  if (d.startsWith("0092")) d = d.slice(4)
  else if (d.startsWith("92") && d.length >= 12) d = d.slice(2)
  else if (d.startsWith("0")) d = d.slice(1)
  if (!d) return ""
  if (d.length <= 3) return `+92-${d}`
  return `+92-${d.slice(0, 3)}-${d.slice(3)}`
}

export function PhoneCell(props: CellProps) {
  return (
    <TextCell
      {...props}
      placeholder="+92-300-1234567"
      onCommit={(next) => props.onCommit(next == null ? null : formatPhone(next))}
    />
  )
}

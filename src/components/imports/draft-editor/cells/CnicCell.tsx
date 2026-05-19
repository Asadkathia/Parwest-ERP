"use client"
import { TextCell, type CellProps } from "./TextCell"

function maskCnic(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 13)
  if (digits.length <= 5) return digits
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
}

export function CnicCell(props: CellProps) {
  return (
    <TextCell
      {...props}
      placeholder="XXXXX-XXXXXXX-X"
      onCommit={(next) => props.onCommit(next == null ? null : maskCnic(next))}
    />
  )
}

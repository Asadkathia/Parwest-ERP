"use client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select"
import type { CellProps } from "./TextCell"

type Props = CellProps & { enumValues: string[] }

export function EnumCell({ value, onCommit, invalid, enumValues }: Props) {
  return (
    <Select
      value={value == null ? "" : String(value)}
      onValueChange={(v) => onCommit(v || null)}
    >
      <SelectTrigger className={`h-7 w-full px-2 py-0 text-sm ${invalid ? "text-destructive" : ""}`}>
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {enumValues.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

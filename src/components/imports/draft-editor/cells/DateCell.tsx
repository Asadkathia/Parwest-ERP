"use client"
import { useState } from "react"
import { format, parseISO, isValid } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover"
import { Calendar } from "@/components/shadcn/calendar"
import { Button } from "@/components/shadcn/button"
import type { CellProps } from "./TextCell"

// Navigable range: old enough for any DOB, far enough out for CNIC expiry.
const START_MONTH = new Date(1940, 0)
const END_MONTH = new Date(new Date().getFullYear() + 30, 11)

export function DateCell({ value, onCommit, invalid }: CellProps) {
  const [open, setOpen] = useState(false)
  const external = typeof value === "string" && value ? value : ""

  // "Adjusting state during render" pattern (same as TextCell): keep the local
  // text buffer in sync when the upstream value changes.
  const [snapshot, setSnapshot] = useState(external)
  const [text, setText] = useState(external)
  if (snapshot !== external) {
    setSnapshot(external)
    setText(external)
  }

  const parsed = (() => {
    const d = parseISO(text)
    return isValid(d) ? d : undefined
  })()

  const commit = (next: string | null) => {
    if (next !== (value == null ? null : String(value))) onCommit(next)
  }

  return (
    <div className="flex items-center gap-1">
      {/* Manual entry — type the date directly (YYYY-MM-DD). */}
      <input
        className={
          "h-7 w-full rounded-sm border bg-background px-2 text-sm transition-colors " +
          "focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring " +
          (invalid
            ? "border-destructive bg-destructive/5 text-destructive"
            : "border-input/40 hover:bg-muted/30 focus:bg-background")
        }
        value={text}
        placeholder="YYYY-MM-DD"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commit(text.trim() === "" ? null : text.trim())}
      />
      {/* Calendar picker — month + year dropdowns for fast navigation. */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open calendar"
            className="h-7 w-7 shrink-0 border border-input/40"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            startMonth={START_MONTH}
            endMonth={END_MONTH}
            defaultMonth={parsed}
            selected={parsed}
            onSelect={(d) => {
              setOpen(false)
              const next = d ? format(d, "yyyy-MM-dd") : null
              setText(next ?? "")
              commit(next)
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

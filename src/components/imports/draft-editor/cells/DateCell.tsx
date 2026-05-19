"use client"
import { useState } from "react"
import { format, parseISO, isValid } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover"
import { Calendar } from "@/components/shadcn/calendar"
import { Button } from "@/components/shadcn/button"
import type { CellProps } from "./TextCell"

export function DateCell({ value, onCommit, invalid }: CellProps) {
  const [open, setOpen] = useState(false)
  const dateValue = typeof value === "string" && value
    ? (() => { const d = parseISO(value); return isValid(d) ? d : undefined })()
    : undefined
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={
            "h-7 w-full justify-start rounded-sm border bg-background px-2 py-0 text-sm font-normal transition-colors hover:bg-muted/30 " +
            (invalid
              ? "border-destructive bg-destructive/5 text-destructive hover:bg-destructive/10"
              : "border-input/40 hover:border-input")
          }
        >
          {dateValue ? format(dateValue, "yyyy-MM-dd") : <span className="text-muted-foreground">YYYY-MM-DD</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={(d) => {
            setOpen(false)
            onCommit(d ? format(d, "yyyy-MM-dd") : null)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

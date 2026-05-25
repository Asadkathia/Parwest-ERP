"use client"
import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/shadcn/command"
import { Button } from "@/components/shadcn/button"
import { Input } from "@/components/shadcn/input"
import type { DraftColumn } from "@/lib/imports/client/useDraft"

type BulkApplyBarProps = {
  columns: DraftColumn[]
  rowCount: number
  /** Apply `value` to `header` across every row. */
  onApply: (header: string, value: string) => Promise<void>
}

/**
 * Toolbar of "set <field> for all rows" controls — one per column flagged
 * `bulkApply` (e.g. supervisor). Saves setting the same value cell-by-cell on
 * a batch that shares one value. fk columns get a searchable combobox; other
 * kinds get a text input.
 */
export function BulkApplyBar({ columns, rowCount, onApply }: BulkApplyBarProps) {
  const targets = columns.filter((c) => c.bulkApply)
  if (targets.length === 0) return null
  return (
    <div className="mb-3 flex flex-wrap items-end gap-4 rounded-md border bg-muted/20 px-3 py-2">
      {targets.map((col) => (
        <BulkApplyControl key={col.key} col={col} rowCount={rowCount} onApply={onApply} />
      ))}
    </div>
  )
}

function BulkApplyControl({
  col,
  rowCount,
  onApply,
}: {
  col: DraftColumn
  rowCount: number
  onApply: (header: string, value: string) => Promise<void>
}) {
  const [value, setValue] = useState("")
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const selected = col.fkOptions?.find((o) => o.value === value)

  const apply = async () => {
    if (!value || busy) return
    setBusy(true)
    try {
      await onApply(col.header, value)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Set {col.label} for all rows
      </span>
      <div className="flex items-center gap-2">
        {col.kind === "fk" ? (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="h-8 w-56 justify-start font-normal">
                {selected?.label ?? (
                  <span className="text-muted-foreground">Choose {col.label.toLowerCase()}…</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0">
              <Command>
                <CommandInput placeholder="Search…" />
                <CommandList>
                  <CommandEmpty>No matches.</CommandEmpty>
                  <CommandGroup>
                    {(col.fkOptions ?? []).map((o) => (
                      <CommandItem
                        key={o.value}
                        value={o.label}
                        onSelect={() => {
                          setValue(o.value)
                          setOpen(false)
                        }}
                      >
                        {o.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <Input
            className="h-8 w-56"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Set ${col.label.toLowerCase()}…`}
          />
        )}
        <Button type="button" size="sm" className="h-8" disabled={!value || busy} onClick={apply}>
          {busy ? "Applying…" : `Apply to ${rowCount} row${rowCount === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  )
}

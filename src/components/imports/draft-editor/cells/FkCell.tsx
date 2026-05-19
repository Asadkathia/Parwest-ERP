"use client"
import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/shadcn/command"
import { Button } from "@/components/shadcn/button"
import type { CellProps } from "./TextCell"

type Props = CellProps & { fkOptions: Array<{ value: string; label: string }> }

export function FkCell({ value, onCommit, invalid, fkOptions = [] }: Props) {
  const [open, setOpen] = useState(false)
  const current = fkOptions.find((o) => o.value === value)
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
          {current?.label ?? (value as string) ?? <span className="text-muted-foreground">—</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {fkOptions.map((o) => (
                <CommandItem key={o.value} value={o.label} onSelect={() => { setOpen(false); onCommit(o.value) }}>
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

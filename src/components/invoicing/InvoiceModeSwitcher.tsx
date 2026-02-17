"use client"

import { InvoiceMode } from "@/lib/mockData"
import { cn } from "@/lib/utils"

type Props = {
  mode: InvoiceMode
  onChange: (mode: InvoiceMode) => void
}

export default function InvoiceModeSwitcher({ mode, onChange }: Props) {
  return (
    <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-1">
      {[
        { label: "Client-wise", value: "CLIENT_WISE" as InvoiceMode },
        { label: "Branch-wise", value: "BRANCH_WISE" as InvoiceMode },
      ].map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-[var(--radius-sm)] px-3 py-1.5 text-sm",
            mode === option.value ? "bg-[var(--brand)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

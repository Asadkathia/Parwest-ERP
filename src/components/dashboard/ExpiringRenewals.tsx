"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardBody, CardHeader } from "@/components/ui/card"
import SectionTitle from "@/components/ui/section-title"
import { cn } from "@/lib/utils"
import type { ExpiringItem } from "@/lib/dashboard/queries"

type Tab = "docs" | "contracts"

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

export default function ExpiringRenewals({ docs, contracts }: { docs: ExpiringItem[]; contracts: ExpiringItem[] }) {
  const [tab, setTab] = useState<Tab>("docs")
  const items = tab === "docs" ? docs : contracts

  return (
    <Card>
      <CardHeader>
        <SectionTitle title="Expiring & Renewals" subtitle="Next 30 days" />
        <div className="mt-3 flex gap-1 rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-1">
          <TabButton active={tab === "docs"} onClick={() => setTab("docs")}>
            Guard Docs ({docs.length})
          </TabButton>
          <TabButton active={tab === "contracts"} onClick={() => setTab("contracts")}>
            Contracts ({contracts.length})
          </TabButton>
        </div>
      </CardHeader>
      <CardBody>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">Nothing expiring in the next 30 days.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const days = item.date ? daysUntil(item.date) : 0
              const urgent = days <= 7
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] p-3 text-sm hover:bg-[var(--surface-muted)] transition"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--text)]">{item.label}</p>
                      <p className="text-xs text-[var(--text-muted)]">{item.sub}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                        urgent
                          ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                          : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                      )}
                    >
                      {days <= 0 ? "today" : `${days}d`}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition",
        active ? "bg-card text-[var(--text)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text)]"
      )}
    >
      {children}
    </button>
  )
}

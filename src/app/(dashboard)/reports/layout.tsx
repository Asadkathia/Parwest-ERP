import Link from "next/link"
import type { ReactNode } from "react"

const TABS = [
  { href: "/reports", label: "Dashboard" },
  { href: "/reports/catalog", label: "Catalog" },
  { href: "/reports/scheduled", label: "Scheduled" },
  { href: "/reports/library", label: "Library" },
]

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Executive analytics, predefined reports, schedules, and run history.
        </p>
      </div>
      <nav className="flex gap-2 border-b" aria-label="Reports tabs">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div>{children}</div>
    </div>
  )
}

import Link from "next/link"
import Panel from "@/components/ui/panel"
import SectionTitle from "@/components/ui/section-title"
import { Inbox, ShieldCheck, Ticket } from "lucide-react"
import type { MyQueueCounts } from "@/lib/dashboard/queries"

export default function MyQueue({ counts, userName }: { counts: MyQueueCounts; userName: string }) {
  const rows = [
    {
      key: "tickets",
      label: "Tickets assigned to me",
      count: counts.myTickets,
      href: "/tickets",
      icon: Ticket,
    },
    {
      key: "approvals",
      label: "Pending admin approvals",
      count: counts.myApprovals,
      href: "/admin-approvals",
      icon: ShieldCheck,
    },
  ]
  return (
    <Panel>
      <SectionTitle title="My Queue" subtitle={userName} />
      <ul className="mt-3 space-y-2">
        {rows.map((r) => {
          const Icon = r.icon
          return (
            <li key={r.key}>
              <Link
                href={r.href}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border)] p-3 text-sm hover:bg-[var(--surface-muted)] transition"
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-[var(--brand)]" />
                  {r.label}
                </span>
                <span
                  className={
                    r.count > 0
                      ? "rounded-full bg-[var(--brand)] px-2 py-0.5 text-xs font-semibold text-white"
                      : "text-xs text-[var(--text-muted)]"
                  }
                >
                  {r.count}
                </span>
              </Link>
            </li>
          )
        })}
        <li>
          <Link
            href="/dashboard/online-users"
            className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--brand)]"
          >
            <Inbox className="h-3.5 w-3.5" />
            View online users
          </Link>
        </li>
      </ul>
    </Panel>
  )
}

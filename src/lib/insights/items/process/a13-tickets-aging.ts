import { registerInsight } from "@/lib/insights/registry"

const CLOSED_STATUS_NAMES = ["CLOSED", "RESOLVED", "COMPLETED", "Closed", "Resolved"]

registerInsight({
  key: "tickets-aging",
  title: "A13 — Tickets aging",
  description: "Open tickets (not CLOSED/RESOLVED/COMPLETED) older than the aging threshold.",
  category: "EFFICIENCY",
  defaultSeverity: "MEDIUM",
  defaultThresholds: {
    ageDays: 14,
  },
  thresholdDocs: {
    ageDays: "Days an open ticket may sit before it counts as aged.",
  },
  compute: async (ctx) => {
    const ageDays = Number(ctx.thresholds.ageDays ?? 14)
    const cutoff = new Date(ctx.now.getTime() - ageDays * 24 * 60 * 60 * 1000)

    const where = {
      createdAt: { lt: cutoff },
      status: { name: { notIn: CLOSED_STATUS_NAMES } },
    }

    const [count, oldest] = await Promise.all([
      ctx.prisma.ticket.count({ where }),
      ctx.prisma.ticket.findMany({
        where,
        orderBy: { createdAt: "asc" },
        take: 5,
        include: {
          assignedTo: { select: { id: true, name: true } },
          status: { select: { name: true } },
        },
      }),
    ])

    if (count === 0) {
      return { count: 0, summary: "No aged open tickets." }
    }

    const items = oldest.map((t) => {
      const days = Math.floor((ctx.now.getTime() - t.createdAt.getTime()) / (24 * 60 * 60 * 1000))
      const assignee = t.assignedTo?.name ?? "unassigned"
      return {
        id: t.id,
        label: `#${t.ticketNumber} — ${t.subject}`,
        sub: `${t.status?.name ?? "?"} · ${days}d · ${assignee}`,
        href: `/tickets/${t.id}`,
      }
    })

    return {
      count,
      summary: `${count} ticket${count === 1 ? "" : "s"} open > ${ageDays}d.`,
      drillUrl: "/tickets",
      items,
    }
  },
})

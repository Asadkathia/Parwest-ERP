import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
})

const definition: ReportDefinition<typeof params> = {
  key: "other.complaints",
  title: "Complaints / tickets",
  description: "Tickets opened in the window with status, priority, and resolution.",
  category: "other",
  paramsSchema: params,
  columns: [
    { key: "ticketNumber", label: "#", type: "number", width: 8 },
    { key: "subject", label: "Subject", type: "string", width: 32 },
    { key: "categoryName", label: "Category", type: "string", width: 16 },
    { key: "priorityName", label: "Priority", type: "string", width: 12 },
    { key: "statusName", label: "Status", type: "string", width: 12 },
    { key: "openedAt", label: "Opened", type: "date", width: 14 },
    { key: "updatedAt", label: "Updated", type: "date", width: 14 },
  ],
  async run({ from, to }, { prisma }) {
    const rows = await prisma.ticket.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: {
        ticketNumber: true,
        subject: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { name: true } },
        priority: { select: { name: true } },
        status: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    })
    return rows.map((t) => ({
      ticketNumber: t.ticketNumber,
      subject: t.subject,
      categoryName: t.category?.name ?? "",
      priorityName: t.priority?.name ?? "",
      statusName: t.status?.name ?? "",
      openedAt: t.createdAt,
      updatedAt: t.updatedAt,
    }))
  },
}

registerReport(definition)
export default definition

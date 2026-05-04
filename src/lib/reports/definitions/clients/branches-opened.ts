import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  clientId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "clients.branches-opened",
  title: "Branches opened",
  description: "New branches created within the date range.",
  category: "clients",
  paramsSchema: params,
  columns: [
    { key: "clientName", label: "Client", type: "string", width: 24 },
    { key: "branchName", label: "Branch", type: "string", width: 24 },
    { key: "city", label: "City", type: "string", width: 16 },
    { key: "status", label: "Status", type: "string", width: 12 },
    { key: "openedOn", label: "Opened", type: "date", width: 14 },
  ],
  async run({ from, to, clientId }, { prisma }) {
    const rows = await prisma.branch.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        ...(clientId ? { clientId } : {}),
      },
      select: {
        name: true,
        city: true,
        status: true,
        createdAt: true,
        client: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    })
    return rows.map((b) => ({
      clientName: b.client?.name ?? "",
      branchName: b.name,
      city: b.city ?? "",
      status: b.status,
      openedOn: b.createdAt,
    }))
  },
}

registerReport(definition)
export default definition

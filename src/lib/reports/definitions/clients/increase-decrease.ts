import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  clientId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "clients.increase-decrease",
  title: "Branch increase / decrease",
  description: "Net change in active deployments per branch over the window.",
  category: "clients",
  paramsSchema: params,
  columns: [
    { key: "clientName", label: "Client", type: "string", width: 22 },
    { key: "branchName", label: "Branch", type: "string", width: 22 },
    { key: "added", label: "Added", type: "number", width: 10 },
    { key: "removed", label: "Removed", type: "number", width: 10 },
    { key: "net", label: "Net", type: "number", width: 10 },
  ],
  async run({ from, to, clientId }, { prisma }) {
    const branches = await prisma.branch.findMany({
      where: { ...(clientId ? { clientId } : {}) },
      select: {
        id: true,
        name: true,
        client: { select: { name: true } },
      },
      take: 5000,
    })
    const ids = branches.map((b) => b.id)
    const added = await prisma.deployment.groupBy({
      by: ["branchId"],
      where: { branchId: { in: ids }, deploymentDate: { gte: from, lte: to } },
      _count: true,
    })
    const removed = await prisma.deployment.groupBy({
      by: ["branchId"],
      where: { branchId: { in: ids }, endDate: { gte: from, lte: to } },
      _count: true,
    })
    const addMap = new Map(added.map((r) => [r.branchId, r._count]))
    const remMap = new Map(removed.map((r) => [r.branchId, r._count]))
    return branches
      .map((b) => {
        const a = addMap.get(b.id) ?? 0
        const r = remMap.get(b.id) ?? 0
        return {
          clientName: b.client?.name ?? "",
          branchName: b.name,
          added: a,
          removed: r,
          net: a - r,
        }
      })
      .filter((row) => row.added > 0 || row.removed > 0)
  },
}

registerReport(definition)
export default definition

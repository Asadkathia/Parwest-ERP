import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  guardId: z.string().optional(),
  branchId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "deployments.history",
  title: "Deployment history",
  description: "All deployments started or ended within the selected window.",
  category: "deployments",
  paramsSchema: params,
  columns: [
    { key: "parwestId", label: "Guard ID", type: "string", width: 14 },
    { key: "guardName", label: "Guard", type: "string", width: 26 },
    { key: "clientName", label: "Client", type: "string", width: 22 },
    { key: "branchName", label: "Branch", type: "string", width: 22 },
    { key: "shiftType", label: "Shift", type: "string", width: 10 },
    { key: "deploymentDate", label: "Start", type: "date", width: 14 },
    { key: "endDate", label: "End", type: "date", width: 14 },
    { key: "status", label: "Status", type: "string", width: 10 },
  ],
  async run({ from, to, guardId, branchId }, { prisma }) {
    const rows = await prisma.deployment.findMany({
      where: {
        OR: [
          { deploymentDate: { gte: from, lte: to } },
          { endDate: { gte: from, lte: to } },
        ],
        ...(guardId ? { guardId } : {}),
        ...(branchId ? { branchId } : {}),
      },
      select: {
        deploymentDate: true,
        endDate: true,
        shiftType: true,
        status: true,
        guard: { select: { parwestId: true, name: true } },
        client: { select: { name: true } },
        branch: { select: { name: true } },
      },
      orderBy: { deploymentDate: "desc" },
      take: 20000,
    })
    return rows.map((d) => ({
      parwestId: d.guard?.parwestId ?? "",
      guardName: d.guard?.name ?? "",
      clientName: d.client?.name ?? "",
      branchName: d.branch?.name ?? "",
      shiftType: d.shiftType,
      deploymentDate: d.deploymentDate,
      endDate: d.endDate,
      status: d.status,
    }))
  },
}

registerReport(definition)
export default definition

import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
})

const definition: ReportDefinition<typeof params> = {
  key: "deployments.short-term",
  title: "Short-term / EXTRA deployments",
  description: "Deployments flagged as EXTRA or TEMPORARY.",
  category: "deployments",
  paramsSchema: params,
  columns: [
    { key: "parwestId", label: "Guard ID", type: "string", width: 14 },
    { key: "guardName", label: "Guard", type: "string", width: 26 },
    { key: "clientName", label: "Client", type: "string", width: 22 },
    { key: "branchName", label: "Branch", type: "string", width: 22 },
    { key: "deploymentType", label: "Type", type: "string", width: 12 },
    { key: "nature", label: "Nature", type: "string", width: 12 },
    { key: "deploymentDate", label: "Start", type: "date", width: 14 },
    { key: "endDate", label: "End", type: "date", width: 14 },
  ],
  async run({ from, to }, { prisma }) {
    const rows = await prisma.deployment.findMany({
      where: {
        deploymentDate: { gte: from, lte: to },
        OR: [
          { deploymentType: "EXTRA" },
          { deploymentNature: "TEMPORARY" },
          { isExtraGuard: true },
        ],
      },
      select: {
        deploymentDate: true,
        endDate: true,
        deploymentType: true,
        deploymentNature: true,
        guard: { select: { parwestId: true, name: true } },
        client: { select: { name: true } },
        branch: { select: { name: true } },
      },
      orderBy: { deploymentDate: "desc" },
      take: 10000,
    })
    return rows.map((d) => ({
      parwestId: d.guard?.parwestId ?? "",
      guardName: d.guard?.name ?? "",
      clientName: d.client?.name ?? "",
      branchName: d.branch?.name ?? "",
      deploymentType: d.deploymentType ?? "",
      nature: d.deploymentNature ?? "",
      deploymentDate: d.deploymentDate,
      endDate: d.endDate,
    }))
  },
}

registerReport(definition)
export default definition

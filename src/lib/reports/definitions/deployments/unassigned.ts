import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  regionId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "deployments.unassigned",
  title: "Unassigned guards",
  description: "Active guards with no current deployment.",
  category: "deployments",
  paramsSchema: params,
  columns: [
    { key: "parwestId", label: "Guard ID", type: "string", width: 14 },
    { key: "name", label: "Name", type: "string", width: 26 },
    { key: "regionName", label: "Region", type: "string", width: 16 },
    { key: "lifecycleStatus", label: "Status", type: "string", width: 12 },
  ],
  async run({ regionId }, { prisma, scope }) {
    const rows = await prisma.guard.findMany({
      where: {
        lifecycleStatus: "ACTIVE",
        deployments: { none: { status: "ACTIVE" } },
        ...(regionId ? { regionId } : {}),
        ...(scope?.regionId ? { regionId: scope.regionId } : {}),
      },
      select: {
        parwestId: true,
        name: true,
        lifecycleStatus: true,
        region: { select: { name: true } },
      },
      orderBy: { name: "asc" },
      take: 10000,
    })
    return rows.map((g) => ({
      parwestId: g.parwestId,
      name: g.name,
      regionName: g.region?.name ?? "",
      lifecycleStatus: g.lifecycleStatus,
    }))
  },
}

registerReport(definition)
export default definition

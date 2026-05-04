import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  regionId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "guards.terminated",
  title: "Terminated guards",
  description: "Guards whose lifecycle status moved to TERMINATED in the range.",
  category: "guards",
  paramsSchema: params,
  columns: [
    { key: "parwestId", label: "Parwest ID", type: "string", width: 14 },
    { key: "name", label: "Name", type: "string", width: 28 },
    { key: "regionName", label: "Region", type: "string", width: 16 },
    { key: "terminationReason", label: "Reason", type: "string", width: 18 },
    { key: "terminatedOn", label: "Terminated", type: "date", width: 14 },
  ],
  async run({ from, to, regionId }, { prisma, scope }) {
    const rows = await prisma.guard.findMany({
      where: {
        lifecycleStatus: "TERMINATED",
        lifecycleStatusUpdatedAt: { gte: from, lte: to },
        ...(regionId ? { regionId } : {}),
        ...(scope?.regionId ? { regionId: scope.regionId } : {}),
      },
      select: {
        parwestId: true,
        name: true,
        terminationReason: true,
        lifecycleStatusUpdatedAt: true,
        region: { select: { name: true } },
      },
      orderBy: { lifecycleStatusUpdatedAt: "desc" },
    })
    return rows.map((g) => ({
      parwestId: g.parwestId,
      name: g.name,
      regionName: g.region?.name ?? "",
      terminationReason: g.terminationReason ?? "",
      terminatedOn: g.lifecycleStatusUpdatedAt,
    }))
  },
}

registerReport(definition)
export default definition

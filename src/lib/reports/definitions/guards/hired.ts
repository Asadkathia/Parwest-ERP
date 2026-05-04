import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  regionId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "guards.hired",
  title: "Hired guards",
  description: "Guards enrolled within the selected date range.",
  category: "guards",
  pinned: true,
  paramsSchema: params,
  columns: [
    { key: "parwestId", label: "Parwest ID", type: "string", width: 14 },
    { key: "name", label: "Name", type: "string", width: 28 },
    { key: "regionName", label: "Region", type: "string", width: 16 },
    { key: "lifecycleStatus", label: "Status", type: "string", width: 12 },
    { key: "joinedOn", label: "Joined", type: "date", width: 14 },
  ],
  async run({ from, to, regionId }, { prisma, scope }) {
    const rows = await prisma.guard.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        ...(regionId ? { regionId } : {}),
        ...(scope?.regionId ? { regionId: scope.regionId } : {}),
      },
      select: {
        parwestId: true,
        name: true,
        lifecycleStatus: true,
        joiningDate: true,
        createdAt: true,
        region: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    })
    return rows.map((g) => ({
      parwestId: g.parwestId,
      name: g.name,
      regionName: g.region?.name ?? "",
      lifecycleStatus: g.lifecycleStatus,
      joinedOn: g.joiningDate ?? g.createdAt,
    }))
  },
}

registerReport(definition)
export default definition

import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  status: z.enum(["PENDING", "ACTIVE", "INACTIVE", "TERMINATED"]).optional(),
  regionId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "guards.verification",
  title: "Verification status",
  description: "Guard lifecycle / verification snapshot.",
  category: "guards",
  paramsSchema: params,
  columns: [
    { key: "parwestId", label: "Parwest ID", type: "string", width: 14 },
    { key: "name", label: "Name", type: "string", width: 28 },
    { key: "lifecycleStatus", label: "Status", type: "string", width: 14 },
    { key: "regionName", label: "Region", type: "string", width: 16 },
    { key: "updatedAt", label: "Updated", type: "date", width: 14 },
  ],
  async run({ status, regionId }, { prisma, scope }) {
    const rows = await prisma.guard.findMany({
      where: {
        ...(status ? { lifecycleStatus: status } : {}),
        ...(regionId ? { regionId } : {}),
        ...(scope?.regionId ? { regionId: scope.regionId } : {}),
      },
      select: {
        parwestId: true,
        name: true,
        lifecycleStatus: true,
        updatedAt: true,
        region: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    })
    return rows.map((g) => ({
      parwestId: g.parwestId,
      name: g.name,
      lifecycleStatus: g.lifecycleStatus,
      regionName: g.region?.name ?? "",
      updatedAt: g.updatedAt,
    }))
  },
}

registerReport(definition)
export default definition

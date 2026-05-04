import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({ regionId: z.string().optional() })

const definition: ReportDefinition<typeof params> = {
  key: "guards.deployment-status",
  title: "Guard deployment status",
  description: "Each guard with their current deployment status.",
  category: "guards",
  paramsSchema: params,
  columns: [
    { key: "parwestId", label: "Parwest ID", type: "string", width: 14 },
    { key: "name", label: "Name", type: "string", width: 28 },
    { key: "lifecycleStatus", label: "Lifecycle", type: "string", width: 12 },
    { key: "isDeployed", label: "Deployed", type: "boolean", width: 10 },
    { key: "deploymentCount", label: "Active deployments", type: "number", width: 10 },
  ],
  async run({ regionId }, { prisma, scope }) {
    const rows = await prisma.guard.findMany({
      where: {
        ...(regionId ? { regionId } : {}),
        ...(scope?.regionId ? { regionId: scope.regionId } : {}),
      },
      select: {
        parwestId: true,
        name: true,
        lifecycleStatus: true,
        deployments: {
          where: { status: "ACTIVE" },
          select: { id: true },
        },
      },
      take: 10000,
    })
    return rows.map((g) => ({
      parwestId: g.parwestId,
      name: g.name,
      lifecycleStatus: g.lifecycleStatus,
      isDeployed: g.deployments.length > 0,
      deploymentCount: g.deployments.length,
    }))
  },
}

registerReport(definition)
export default definition

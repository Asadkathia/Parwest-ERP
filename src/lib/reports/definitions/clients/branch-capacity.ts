import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  clientId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "clients.branch-capacity",
  title: "Branch guard capacity",
  description: "Required vs currently deployed guards per branch.",
  category: "clients",
  paramsSchema: params,
  columns: [
    { key: "clientName", label: "Client", type: "string", width: 22 },
    { key: "branchName", label: "Branch", type: "string", width: 22 },
    { key: "required", label: "Required", type: "number", width: 10 },
    { key: "deployed", label: "Deployed", type: "number", width: 10 },
    { key: "gap", label: "Gap", type: "number", width: 10 },
  ],
  async run({ clientId }, { prisma }) {
    const rows = await prisma.branch.findMany({
      where: {
        status: "ACTIVE",
        ...(clientId ? { clientId } : {}),
      },
      select: {
        name: true,
        dayGuardCapacity: true,
        nightGuardCapacity: true,
        client: { select: { name: true } },
        deployments: { where: { status: "ACTIVE" }, select: { id: true } },
      },
      take: 5000,
    })
    return rows.map((b) => {
      const required = (b.dayGuardCapacity ?? 0) + (b.nightGuardCapacity ?? 0)
      const deployed = b.deployments.length
      return {
        clientName: b.client?.name ?? "",
        branchName: b.name,
        required,
        deployed,
        gap: required - deployed,
      }
    })
  },
}

registerReport(definition)
export default definition

import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  regionId: z.string().optional(),
  clientId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "deployments.current",
  title: "Currently deployed guards",
  description: "Active deployments by region, client, branch, and shift.",
  category: "deployments",
  pinned: true,
  paramsSchema: params,
  columns: [
    { key: "parwestId", label: "Guard ID", type: "string", width: 14 },
    { key: "guardName", label: "Guard", type: "string", width: 26 },
    { key: "clientName", label: "Client", type: "string", width: 22 },
    { key: "branchName", label: "Branch", type: "string", width: 22 },
    { key: "shiftType", label: "Shift", type: "string", width: 10 },
    { key: "designation", label: "Designation", type: "string", width: 16 },
    { key: "deployedOn", label: "Since", type: "date", width: 14 },
  ],
  async run({ regionId, clientId }, { prisma, scope }) {
    const rows = await prisma.deployment.findMany({
      where: {
        status: "ACTIVE",
        ...(clientId ? { clientId } : {}),
        ...(regionId
          ? { OR: [{ guard: { regionId } }, { branch: { is: { regionalOffice: { regionId } } } }] }
          : {}),
        ...(scope?.regionId
          ? { regionalOffice: { is: { regionId: scope.regionId } } }
          : {}),
      },
      select: {
        deploymentDate: true,
        shiftType: true,
        designation: true,
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
      shiftType: d.shiftType,
      designation: d.designation,
      deployedOn: d.deploymentDate,
    }))
  },
}

registerReport(definition)
export default definition

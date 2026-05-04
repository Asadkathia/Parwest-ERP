import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "BLACKLISTED"]).optional(),
  regionId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "clients.active-inactive",
  title: "Active / inactive clients",
  description: "Snapshot of all clients by status.",
  category: "clients",
  paramsSchema: params,
  columns: [
    { key: "name", label: "Name", type: "string", width: 28 },
    { key: "status", label: "Status", type: "string", width: 14 },
    { key: "regionName", label: "Region", type: "string", width: 16 },
    { key: "branchCount", label: "Branches", type: "number", width: 10 },
    { key: "enrolledOn", label: "Enrolled", type: "date", width: 14 },
  ],
  async run({ status, regionId }, { prisma, scope }) {
    const rows = await prisma.client.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(regionId ? { regionId } : {}),
        ...(scope?.regionId ? { regionId: scope.regionId } : {}),
      },
      select: {
        name: true,
        status: true,
        enrollmentDate: true,
        region: { select: { name: true } },
        _count: { select: { branches: true } },
      },
      orderBy: { name: "asc" },
    })
    return rows.map((c) => ({
      name: c.name,
      status: c.status,
      regionName: c.region?.name ?? "",
      branchCount: c._count.branches,
      enrolledOn: c.enrollmentDate,
    }))
  },
}

registerReport(definition)
export default definition

import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  regionId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "guards.expiring-docs",
  title: "Expiring documents",
  description: "Guard CNICs expiring within the lookahead window.",
  category: "guards",
  paramsSchema: params,
  columns: [
    { key: "parwestId", label: "Parwest ID", type: "string", width: 14 },
    { key: "name", label: "Name", type: "string", width: 28 },
    { key: "cnic", label: "CNIC", type: "string", width: 18 },
    { key: "cnicExpiryDate", label: "Expires", type: "date", width: 14 },
    { key: "regionName", label: "Region", type: "string", width: 16 },
  ],
  async run({ days, regionId }, { prisma, scope }) {
    const now = new Date()
    const horizon = new Date(now.getTime() + days * 24 * 3600 * 1000)
    const rows = await prisma.guard.findMany({
      where: {
        cnicExpiryDate: { gte: now, lte: horizon },
        ...(regionId ? { regionId } : {}),
        ...(scope?.regionId ? { regionId: scope.regionId } : {}),
      },
      select: {
        parwestId: true,
        name: true,
        cnic: true,
        cnicExpiryDate: true,
        region: { select: { name: true } },
      },
      orderBy: { cnicExpiryDate: "asc" },
    })
    return rows.map((g) => ({
      parwestId: g.parwestId,
      name: g.name,
      cnic: g.cnic,
      cnicExpiryDate: g.cnicExpiryDate,
      regionName: g.region?.name ?? "",
    }))
  },
}

registerReport(definition)
export default definition

import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"
import { clientScopeWhere } from "@/lib/clients/access"

const params = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  regionId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "clients.enrolled",
  title: "Enrolled clients",
  description: "Clients enrolled within the selected window.",
  category: "clients",
  pinned: true,
  paramsSchema: params,
  columns: [
    { key: "name", label: "Name", type: "string", width: 28 },
    { key: "type", label: "Type", type: "string", width: 14 },
    { key: "regionName", label: "Region", type: "string", width: 16 },
    { key: "status", label: "Status", type: "string", width: 12 },
    { key: "enrolledOn", label: "Enrolled", type: "date", width: 14 },
  ],
  async run({ from, to, regionId }, { prisma, scope }) {
    const rows = await prisma.client.findMany({
      where: {
        AND: [
          { enrollmentDate: { gte: from, lte: to } },
          ...(regionId
            ? [
                {
                  OR: [
                    { branches: { some: { regionalOffice: { regionId } } } },
                    { isBranchless: true, regionId },
                  ],
                },
              ]
            : []),
          clientScopeWhere(scope),
        ],
      },
      select: {
        name: true,
        type: true,
        status: true,
        enrollmentDate: true,
        region: { select: { name: true } },
        branches: {
          select: { regionalOffice: { select: { region: { select: { name: true } } } } },
          take: 1,
        },
      },
      orderBy: { enrollmentDate: "desc" },
    })
    return rows.map((c) => ({
      name: c.name,
      type: c.type,
      status: c.status,
      regionName:
        c.region?.name ?? c.branches[0]?.regionalOffice?.region?.name ?? "—",
      enrolledOn: c.enrollmentDate,
    }))
  },
}

registerReport(definition)
export default definition

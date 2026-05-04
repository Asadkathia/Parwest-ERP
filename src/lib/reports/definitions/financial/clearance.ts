import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
})

const definition: ReportDefinition<typeof params> = {
  key: "financial.clearance",
  title: "Final settlement clearances",
  description: "Resigned guards in the period with their final-settlement window.",
  category: "financial",
  paramsSchema: params,
  columns: [
    { key: "parwestId", label: "Guard ID", type: "string", width: 14 },
    { key: "name", label: "Guard", type: "string", width: 26 },
    { key: "lifecycleStatus", label: "Status", type: "string", width: 12 },
    { key: "resignedOn", label: "Resigned", type: "date", width: 14 },
    { key: "terminationReason", label: "Reason", type: "string", width: 16 },
  ],
  async run({ from, to }, { prisma }) {
    const rows = await prisma.guard.findMany({
      where: {
        resignedOn: { gte: from, lte: to },
      },
      select: {
        parwestId: true,
        name: true,
        lifecycleStatus: true,
        terminationReason: true,
        resignedOn: true,
      },
      orderBy: { resignedOn: "desc" },
    })
    return rows.map((g) => ({
      parwestId: g.parwestId,
      name: g.name,
      lifecycleStatus: g.lifecycleStatus,
      resignedOn: g.resignedOn,
      terminationReason: g.terminationReason ?? "",
    }))
  },
}

registerReport(definition)
export default definition

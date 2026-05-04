import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  month: z.coerce.date().optional(),
  regionId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "financial.unpaid-salary",
  title: "Unpaid salary",
  description: "Outstanding payrolls (status PENDING or UNPAID).",
  category: "financial",
  paramsSchema: params,
  columns: [
    { key: "month", label: "Month", type: "date", width: 14 },
    { key: "parwestId", label: "Guard ID", type: "string", width: 14 },
    { key: "guardName", label: "Guard", type: "string", width: 26 },
    { key: "netSalary", label: "Owed", type: "currency", width: 14 },
    { key: "paymentStatus", label: "Status", type: "string", width: 12 },
  ],
  async run({ month, regionId }, { prisma }) {
    let dateFilter: { gte: Date; lte: Date } | undefined
    if (month) {
      const start = new Date(month.getFullYear(), month.getMonth(), 1)
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59)
      dateFilter = { gte: start, lte: end }
    }
    const rows = await prisma.payroll.findMany({
      where: {
        paymentStatus: { in: ["PENDING", "UNPAID"] },
        ...(dateFilter ? { month: dateFilter } : {}),
        ...(regionId ? { regionId } : {}),
      },
      select: {
        month: true,
        netSalary: true,
        paymentStatus: true,
        guard: { select: { parwestId: true, name: true } },
      },
      orderBy: { month: "desc" },
    })
    return rows.map((p) => ({
      month: p.month,
      parwestId: p.guard?.parwestId ?? "",
      guardName: p.guard?.name ?? "",
      netSalary: p.netSalary,
      paymentStatus: p.paymentStatus,
    }))
  },
}

registerReport(definition)
export default definition

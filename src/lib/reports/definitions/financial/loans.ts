import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  status: z.enum(["PENDING", "FINALIZED"]).optional(),
  regionId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "financial.loans",
  title: "Loans",
  description: "Guard loans by status.",
  category: "financial",
  paramsSchema: params,
  columns: [
    { key: "month", label: "Month", type: "date", width: 14 },
    { key: "parwestId", label: "Guard ID", type: "string", width: 14 },
    { key: "guardName", label: "Guard", type: "string", width: 26 },
    { key: "amount", label: "Amount", type: "currency", width: 14 },
    { key: "status", label: "Status", type: "string", width: 12 },
    { key: "paymentDate", label: "Paid On", type: "date", width: 14 },
  ],
  async run({ status, regionId }, { prisma }) {
    const rows = await prisma.loan.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(regionId ? { regionId } : {}),
      },
      select: {
        month: true,
        amount: true,
        status: true,
        paymentDate: true,
        guard: { select: { parwestId: true, name: true } },
      },
      orderBy: { month: "desc" },
      take: 10000,
    })
    return rows.map((l) => ({
      month: l.month,
      parwestId: l.guard?.parwestId ?? "",
      guardName: l.guard?.name ?? "",
      amount: l.amount,
      status: l.status,
      paymentDate: l.paymentDate,
    }))
  },
}

registerReport(definition)
export default definition

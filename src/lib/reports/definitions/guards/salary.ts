import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  guardId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "guards.salary",
  title: "Guard salary history",
  description: "Per-guard payroll lines in the date range.",
  category: "guards",
  paramsSchema: params,
  columns: [
    { key: "month", label: "Month", type: "date", width: 14 },
    { key: "parwestId", label: "Guard ID", type: "string", width: 14 },
    { key: "guardName", label: "Guard", type: "string", width: 26 },
    { key: "baseSalary", label: "Base", type: "currency", width: 14 },
    { key: "extraHoursAmount", label: "Extras", type: "currency", width: 14 },
    { key: "loans", label: "Loans", type: "currency", width: 12 },
    { key: "netSalary", label: "Net", type: "currency", width: 14 },
    { key: "paymentStatus", label: "Status", type: "string", width: 12 },
  ],
  async run({ from, to, guardId }, { prisma }) {
    const rows = await prisma.payroll.findMany({
      where: {
        month: { gte: from, lte: to },
        ...(guardId ? { guardId } : {}),
      },
      select: {
        month: true,
        baseSalary: true,
        extraHoursAmount: true,
        loans: true,
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
      baseSalary: p.baseSalary,
      extraHoursAmount: p.extraHoursAmount,
      loans: p.loans,
      netSalary: p.netSalary,
      paymentStatus: p.paymentStatus,
    }))
  },
}

registerReport(definition)
export default definition

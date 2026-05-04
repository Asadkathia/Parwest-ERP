import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  month: z.coerce.date(),
  regionId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "financial.salary-export",
  title: "Salary export",
  description: "Bank-ready payroll export for the selected month.",
  category: "financial",
  pinned: true,
  paramsSchema: params,
  columns: [
    { key: "parwestId", label: "Guard ID", type: "string", width: 14 },
    { key: "guardName", label: "Guard", type: "string", width: 26 },
    { key: "bankName", label: "Bank", type: "string", width: 16 },
    { key: "accountNumber", label: "Account", type: "string", width: 22 },
    { key: "iban", label: "IBAN", type: "string", width: 24 },
    { key: "netSalary", label: "Net Pay", type: "currency", width: 14 },
  ],
  async run({ month, regionId }, { prisma }) {
    const start = new Date(month.getFullYear(), month.getMonth(), 1)
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59)
    const rows = await prisma.payroll.findMany({
      where: {
        month: { gte: start, lte: end },
        ...(regionId ? { regionId } : {}),
      },
      select: {
        netSalary: true,
        guard: {
          select: {
            parwestId: true,
            name: true,
            bankName: true,
            bankAccountNumber: true,
            bankIban: true,
          },
        },
      },
      orderBy: { netSalary: "desc" },
    })
    return rows.map((p) => ({
      parwestId: p.guard?.parwestId ?? "",
      guardName: p.guard?.name ?? "",
      bankName: p.guard?.bankName ?? "",
      accountNumber: p.guard?.bankAccountNumber ?? "",
      iban: p.guard?.bankIban ?? "",
      netSalary: p.netSalary,
    }))
  },
}

registerReport(definition)
export default definition

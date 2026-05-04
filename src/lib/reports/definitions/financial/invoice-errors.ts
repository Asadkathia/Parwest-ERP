import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
})

const definition: ReportDefinition<typeof params> = {
  key: "financial.invoice-errors",
  title: "Invoice errors",
  description: "Voided / disputed invoices in the window.",
  category: "financial",
  paramsSchema: params,
  columns: [
    { key: "invoiceNumber", label: "Invoice #", type: "string", width: 16 },
    { key: "clientName", label: "Client", type: "string", width: 24 },
    { key: "amount", label: "Amount", type: "currency", width: 14 },
    { key: "status", label: "Status", type: "string", width: 12 },
    { key: "voidReason", label: "Void reason", type: "string", width: 24 },
    { key: "voidedAt", label: "Voided at", type: "date", width: 14 },
  ],
  async run({ from, to }, { prisma }) {
    const rows = await prisma.invoice.findMany({
      where: {
        OR: [
          { voidedAt: { gte: from, lte: to } },
          { status: "VOIDED" as never },
        ],
      },
      select: {
        invoiceNumber: true,
        amount: true,
        status: true,
        voidReason: true,
        voidedAt: true,
        client: { select: { name: true } },
      },
      orderBy: { voidedAt: "desc" },
    })
    return rows.map((i) => ({
      invoiceNumber: i.invoiceNumber,
      clientName: i.client?.name ?? "",
      amount: i.amount,
      status: i.status,
      voidReason: i.voidReason ?? "",
      voidedAt: i.voidedAt,
    }))
  },
}

registerReport(definition)
export default definition

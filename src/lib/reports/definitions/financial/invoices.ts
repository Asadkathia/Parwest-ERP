import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  clientId: z.string().optional(),
  status: z.enum(["DRAFT", "PENDING", "PAID", "OVERDUE", "VOIDED"]).optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "financial.invoices",
  title: "Invoices",
  description: "Invoices issued in the selected window.",
  category: "financial",
  pinned: true,
  paramsSchema: params,
  columns: [
    { key: "invoiceNumber", label: "Invoice #", type: "string", width: 16 },
    { key: "clientName", label: "Client", type: "string", width: 24 },
    { key: "branchName", label: "Branch", type: "string", width: 22 },
    { key: "month", label: "Month", type: "date", width: 14 },
    { key: "amount", label: "Amount", type: "currency", width: 14 },
    { key: "paidAmount", label: "Paid", type: "currency", width: 14 },
    { key: "status", label: "Status", type: "string", width: 12 },
    { key: "dueDate", label: "Due", type: "date", width: 14 },
  ],
  async run({ from, to, clientId, status }, { prisma }) {
    const rows = await prisma.invoice.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        ...(clientId ? { clientId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      select: {
        invoiceNumber: true,
        month: true,
        amount: true,
        paidAmount: true,
        status: true,
        dueDate: true,
        client: { select: { name: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    })
    return rows.map((i) => ({
      invoiceNumber: i.invoiceNumber,
      clientName: i.client?.name ?? "",
      branchName: i.branch?.name ?? "",
      month: i.month,
      amount: i.amount,
      paidAmount: i.paidAmount,
      status: i.status,
      dueDate: i.dueDate,
    }))
  },
}

registerReport(definition)
export default definition

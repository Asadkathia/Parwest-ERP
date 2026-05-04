import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  guardId: z.string().optional(),
  clientId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "guards.attendance",
  title: "Guard attendance",
  description: "Daily attendance records for the selected window.",
  category: "guards",
  paramsSchema: params,
  columns: [
    { key: "date", label: "Date", type: "date", width: 14 },
    { key: "parwestId", label: "Guard ID", type: "string", width: 14 },
    { key: "guardName", label: "Guard", type: "string", width: 26 },
    { key: "status", label: "Status", type: "string", width: 12 },
    { key: "shiftType", label: "Shift", type: "string", width: 8 },
    { key: "hoursWorked", label: "Hours", type: "number", width: 8 },
    { key: "clientName", label: "Client", type: "string", width: 22 },
  ],
  async run({ from, to, guardId, clientId }, { prisma }) {
    const rows = await prisma.attendance.findMany({
      where: {
        date: { gte: from, lte: to },
        ...(guardId ? { guardId } : {}),
        ...(clientId ? { clientId } : {}),
      },
      select: {
        date: true,
        status: true,
        shiftType: true,
        hoursWorked: true,
        clientName: true,
        guard: { select: { parwestId: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: 20000,
    })
    return rows.map((a) => ({
      date: a.date,
      parwestId: a.guard?.parwestId ?? "",
      guardName: a.guard?.name ?? "",
      status: a.status,
      shiftType: a.shiftType ?? "",
      hoursWorked: a.hoursWorked ?? 0,
      clientName: a.clientName ?? "",
    }))
  },
}

registerReport(definition)
export default definition

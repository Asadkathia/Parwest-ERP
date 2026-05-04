import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  clientId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "deployments.day-night",
  title: "Day / night duty",
  description: "Active day vs night vs both deployments per branch.",
  category: "deployments",
  paramsSchema: params,
  columns: [
    { key: "clientName", label: "Client", type: "string", width: 22 },
    { key: "branchName", label: "Branch", type: "string", width: 22 },
    { key: "day", label: "Day", type: "number", width: 8 },
    { key: "night", label: "Night", type: "number", width: 8 },
    { key: "both", label: "Both", type: "number", width: 8 },
    { key: "total", label: "Total", type: "number", width: 8 },
  ],
  async run({ clientId }, { prisma }) {
    const rows = await prisma.deployment.findMany({
      where: {
        status: "ACTIVE",
        ...(clientId ? { clientId } : {}),
      },
      select: {
        shiftType: true,
        client: { select: { name: true } },
        branch: { select: { name: true } },
      },
      take: 50000,
    })
    const map = new Map<
      string,
      { clientName: string; branchName: string; day: number; night: number; both: number }
    >()
    for (const d of rows) {
      const key = `${d.client?.name ?? ""}::${d.branch?.name ?? "(no branch)"}`
      const cur =
        map.get(key) ??
        { clientName: d.client?.name ?? "", branchName: d.branch?.name ?? "(no branch)", day: 0, night: 0, both: 0 }
      const s = (d.shiftType || "").toUpperCase()
      if (s === "DAY") cur.day += 1
      else if (s === "NIGHT") cur.night += 1
      else if (s === "BOTH") cur.both += 1
      map.set(key, cur)
    }
    return Array.from(map.values())
      .map((r) => ({ ...r, total: r.day + r.night + r.both }))
      .sort((a, b) => b.total - a.total)
  },
}

registerReport(definition)
export default definition

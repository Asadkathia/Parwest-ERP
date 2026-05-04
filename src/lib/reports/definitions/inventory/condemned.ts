import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "inventory.condemned",
  title: "Condemned items",
  description: "Inventory adjustments flagged as write-offs / condemned stock.",
  category: "inventory",
  paramsSchema: params,
  columns: [
    { key: "adjustedAt", label: "Date", type: "date", width: 14 },
    { key: "storeName", label: "Store", type: "string", width: 22 },
    { key: "productName", label: "Product", type: "string", width: 28 },
    { key: "qty", label: "Qty", type: "number", width: 10 },
    { key: "reason", label: "Reason", type: "string", width: 24 },
  ],
  async run({ from, to }, { prisma }) {
    const rows = await prisma.storeInventoryAdjustmentLine.findMany({
      where: {
        adjustment: {
          adjustmentType: { in: ["DAMAGE", "WRITE_OFF", "CONDEMNATION"] as never },
          ...(from || to
            ? { adjustedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
            : {}),
        },
      },
      select: {
        quantityDelta: true,
        adjustment: {
          select: {
            adjustedAt: true,
            reason: true,
            store: { select: { name: true } },
          },
        },
        product: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    })
    return rows.map((l) => ({
      adjustedAt: l.adjustment?.adjustedAt,
      storeName: l.adjustment?.store?.name ?? "",
      productName: l.product?.name ?? "",
      qty: Math.abs(l.quantityDelta),
      reason: l.adjustment?.reason ?? "",
    }))
  },
}

registerReport(definition)
export default definition

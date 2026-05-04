import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  storeId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "inventory.total",
  title: "Total inventory",
  description: "Stock balances per store and product, with valuation.",
  category: "inventory",
  pinned: true,
  paramsSchema: params,
  columns: [
    { key: "storeName", label: "Store", type: "string", width: 22 },
    { key: "productName", label: "Product", type: "string", width: 28 },
    { key: "sku", label: "SKU", type: "string", width: 14 },
    { key: "onHand", label: "On Hand", type: "number", width: 10, align: "right" },
    { key: "held", label: "Held", type: "number", width: 10, align: "right" },
    { key: "issued", label: "Issued", type: "number", width: 10, align: "right" },
    { key: "value", label: "Value", type: "currency", width: 14, align: "right" },
  ],
  async run({ storeId }, { prisma }) {
    const rows = await prisma.storeInventoryBalance.findMany({
      where: { ...(storeId ? { storeId } : {}) },
      select: {
        quantityOnHand: true,
        quantityHeld: true,
        quantityIssued: true,
        avgUnitCost: true,
        store: { select: { name: true } },
        product: { select: { name: true, sku: true } },
      },
      orderBy: [{ store: { name: "asc" } }, { product: { name: "asc" } }],
      take: 20000,
    })
    return rows.map((r) => ({
      storeName: r.store?.name ?? "",
      productName: r.product?.name ?? "",
      sku: r.product?.sku ?? "",
      onHand: r.quantityOnHand,
      held: r.quantityHeld,
      issued: r.quantityIssued,
      value: (r.avgUnitCost ?? 0) * r.quantityOnHand,
    }))
  },
}

registerReport(definition)
export default definition

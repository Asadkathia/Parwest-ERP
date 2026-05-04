import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({})

const definition: ReportDefinition<typeof params> = {
  key: "inventory.by-status",
  title: "Inventory by status",
  description: "Stock split into on-hand, held, and issued totals per product.",
  category: "inventory",
  paramsSchema: params,
  columns: [
    { key: "productName", label: "Product", type: "string", width: 28 },
    { key: "sku", label: "SKU", type: "string", width: 14 },
    { key: "onHand", label: "On Hand", type: "number", width: 10 },
    { key: "held", label: "Held", type: "number", width: 10 },
    { key: "issued", label: "Issued", type: "number", width: 10 },
  ],
  async run(_p, { prisma }) {
    const rows = await prisma.storeInventoryBalance.groupBy({
      by: ["productId"],
      _sum: {
        quantityOnHand: true,
        quantityHeld: true,
        quantityIssued: true,
      },
    })
    const ids = rows.map((r) => r.productId)
    const products = await prisma.storeInventoryProduct.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, sku: true },
    })
    const pmap = new Map(products.map((p) => [p.id, p]))
    return rows.map((r) => ({
      productName: pmap.get(r.productId)?.name ?? "",
      sku: pmap.get(r.productId)?.sku ?? "",
      onHand: r._sum.quantityOnHand ?? 0,
      held: r._sum.quantityHeld ?? 0,
      issued: r._sum.quantityIssued ?? 0,
    }))
  },
}

registerReport(definition)
export default definition

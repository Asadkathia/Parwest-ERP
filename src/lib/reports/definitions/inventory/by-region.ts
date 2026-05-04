import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({})

const definition: ReportDefinition<typeof params> = {
  key: "inventory.by-region",
  title: "Inventory by region",
  description: "Stock distribution across regional stores.",
  category: "inventory",
  paramsSchema: params,
  columns: [
    { key: "regionName", label: "Region", type: "string", width: 18 },
    { key: "storeName", label: "Store", type: "string", width: 22 },
    { key: "productName", label: "Product", type: "string", width: 28 },
    { key: "onHand", label: "On Hand", type: "number", width: 10 },
  ],
  async run(_p, { prisma }) {
    const rows = await prisma.storeInventoryBalance.findMany({
      where: { quantityOnHand: { gt: 0 } },
      select: {
        quantityOnHand: true,
        store: {
          select: {
            name: true,
            regionalOffice: { select: { name: true, region: { select: { name: true } } } },
          },
        },
        product: { select: { name: true } },
      },
      take: 20000,
    })
    return rows.map((r) => ({
      regionName: r.store?.regionalOffice?.region?.name ?? r.store?.regionalOffice?.name ?? "",
      storeName: r.store?.name ?? "",
      productName: r.product?.name ?? "",
      onHand: r.quantityOnHand,
    }))
  },
}

registerReport(definition)
export default definition

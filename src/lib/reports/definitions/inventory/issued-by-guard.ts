import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  guardId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "inventory.issued-by-guard",
  title: "Issued items by guard",
  description: "Items currently issued (assigned + not returned) per guard.",
  category: "inventory",
  paramsSchema: params,
  columns: [
    { key: "parwestId", label: "Guard ID", type: "string", width: 14 },
    { key: "guardName", label: "Guard", type: "string", width: 26 },
    { key: "productName", label: "Item", type: "string", width: 28 },
    { key: "quantity", label: "Qty", type: "number", width: 8 },
    { key: "assignedAt", label: "Issued On", type: "date", width: 14 },
  ],
  async run({ guardId }, { prisma }) {
    const rows = await prisma.storeInventoryAssignment.findMany({
      where: {
        status: "ASSIGNED",
        returnedAt: null,
        assignedToType: "GUARD",
        ...(guardId ? { assignedToGuardId: guardId } : {}),
      },
      select: {
        quantity: true,
        assignedAt: true,
        product: { select: { name: true } },
        assignedToGuard: { select: { parwestId: true, name: true } },
      },
      orderBy: { assignedAt: "desc" },
      take: 10000,
    })
    return rows.map((a) => ({
      parwestId: a.assignedToGuard?.parwestId ?? "",
      guardName: a.assignedToGuard?.name ?? "",
      productName: a.product?.name ?? "",
      quantity: a.quantity,
      assignedAt: a.assignedAt,
    }))
  },
}

registerReport(definition)
export default definition

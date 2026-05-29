import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { forbidden, internalServerError, ok, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "GUARDS", "VIEW")) return forbidden("Access denied.")

  const { id } = await params

  try {
    const assignments = await prisma.storeInventoryAssignment.findMany({
      where: { assignedToGuardId: id },
      orderBy: { assignedAt: "desc" },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            variation: { select: { name: true } },
          },
        },
        condition: { select: { id: true, name: true } },
        returnCondition: { select: { id: true, name: true } },
        assignedByUser: { select: { id: true, name: true } },
        returnedByUser: { select: { id: true, name: true } },
      },
    })

    const rows = assignments.map((a) => ({
      id: a.id,
      productName: a.product.name,
      productSku: a.product.sku,
      productVariation: a.product.variation?.name ?? null,
      quantity: a.quantity,
      assignedAt: a.assignedAt.toISOString(),
      conditionName: a.condition?.name ?? null,
      assignedByName: a.assignedByUser?.name ?? null,
      returnedAt: a.returnedAt ? a.returnedAt.toISOString() : null,
      returnConditionName: a.returnCondition?.name ?? null,
      returnedByName: a.returnedByUser?.name ?? null,
      status: a.status,
    }))

    return ok(rows)
  } catch (error) {
    console.error(`[GET /api/guards/${id}/store-inventory] failed:`, error)
    return internalServerError("Failed to load store inventory records.")
  }
}
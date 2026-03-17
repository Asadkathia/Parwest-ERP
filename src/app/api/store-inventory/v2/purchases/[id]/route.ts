import { NextRequest } from "next/server"
import { internalServerError, notFound, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { requireInventorySession } from "@/lib/inventory/store-v2-api"

const purchaseInclude = {
  store: true,
  createdBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  lines: {
    include: {
      product: true,
    },
  },
}

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const { id } = await params

  try {
    const row = await prisma.storeInventoryPurchase.findUnique({
      where: { id },
      include: purchaseInclude,
    })
    if (!row) return notFound("Purchase not found.")

    return ok(row)
  } catch (error) {
    console.error(`store-inventory v2 purchases GET (${id}) failed`, error)
    return internalServerError("Failed to fetch purchase.")
  }
}

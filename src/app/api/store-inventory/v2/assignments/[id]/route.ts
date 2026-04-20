import { NextRequest } from "next/server"
import { internalServerError, notFound, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { requireInventorySession } from "@/lib/inventory/store-v2-api"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const { id } = await params

  try {
    const row = await prisma.storeInventoryAssignment.findUnique({
      where: { id },
      include: {
        store: true,
        product: true,
        condition: true,
        assignedToGuard: { select: { id: true, name: true, parwestId: true, cnic: true } },
        assignedToClient: { select: { id: true, name: true, type: true } },
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
        returnedByUser: { select: { id: true, name: true, email: true } },
      },
    })

    if (!row) return notFound("Assignment not found.")
    return ok(row)
  } catch (error) {
    console.error(`store-inventory v2 assignments GET (${id}) failed`, error)
    return internalServerError("Failed to fetch assignment.")
  }
}

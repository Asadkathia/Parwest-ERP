import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, notFound, unauthorized } from "@/lib/api/response"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const { id } = await params
    const body = await request.json()
    const returnedAtRaw = body.returnedAt ? String(body.returnedAt) : null
    const returnedAt = returnedAtRaw ? new Date(returnedAtRaw) : new Date()
    if (Number.isNaN(returnedAt.getTime())) {
      return badRequest("Invalid returnedAt value.")
    }

    const existing = await prisma.inventoryAssignment.findUnique({
      where: { id },
      select: {
        id: true,
        itemId: true,
        assignedAt: true,
        returnedAt: true,
      },
    })
    if (!existing) {
      return notFound("Assignment not found.")
    }
    if (existing.returnedAt) {
      return conflict("Assignment is already returned.")
    }
    if (returnedAt < existing.assignedAt) {
      return badRequest("returnedAt cannot be earlier than assignedAt.")
    }

    const updated = await prisma.inventoryAssignment.update({
      where: { id },
      data: {
        returnedAt,
        notes: body.notes !== undefined ? String(body.notes || "") : undefined,
      },
      include: {
        item: {
          include: {
            category: true,
            vendor: true,
          },
        },
        guard: {
          select: { id: true, name: true, parwestId: true },
        },
        client: {
          select: { id: true, name: true },
        },
      },
    })

    const otherOpenAssignments = await prisma.inventoryAssignment.findFirst({
      where: {
        itemId: updated.itemId,
        returnedAt: null,
        id: { not: updated.id },
      },
      select: { id: true },
    })
    await prisma.inventoryItem.update({
      where: { id: updated.itemId },
      data: { status: otherOpenAssignments ? "ISSUED" : "AVAILABLE" },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (getPrismaCode(error) === "P2025") {
      return notFound("Assignment not found.")
    }
    console.error("Error updating inventory assignment:", error)
    return internalServerError("Failed to update assignment.")
  }
}

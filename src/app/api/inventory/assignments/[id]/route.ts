import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const body = await request.json()

    const updated = await prisma.inventoryAssignment.update({
      where: { id },
      data: {
        returnedAt: body.returnedAt ? new Date(String(body.returnedAt)) : new Date(),
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

    await prisma.inventoryItem.update({
      where: { id: updated.itemId },
      data: { status: "AVAILABLE" },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    if (String(error?.code) === "P2025") {
      return NextResponse.json({ message: "Assignment not found." }, { status: 404 })
    }
    console.error("Error updating inventory assignment:", error)
    return NextResponse.json({ message: "Failed to update assignment." }, { status: 500 })
  }
}

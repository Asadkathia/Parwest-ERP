import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const rows = await prisma.inventoryAssignment.findMany({
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
      orderBy: { assignedAt: "desc" },
      take: 500,
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching inventory assignments:", error)
    return NextResponse.json({ message: "Failed to fetch assignments." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const itemId = String(body.itemId || "")
    const assignTo = String(body.assignTo || "")
    const entityId = String(body.entityId || "")

    if (!itemId || !assignTo || !entityId) {
      return NextResponse.json({ message: "itemId, assignTo and entityId are required." }, { status: 400 })
    }
    if (assignTo !== "GUARD" && assignTo !== "CLIENT") {
      return NextResponse.json({ message: "assignTo must be GUARD or CLIENT." }, { status: 400 })
    }

    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      select: { id: true, status: true },
    })
    if (!item) return NextResponse.json({ message: "Item not found." }, { status: 404 })

    const assignment = await prisma.inventoryAssignment.create({
      data: {
        itemId,
        guardId: assignTo === "GUARD" ? entityId : null,
        clientId: assignTo === "CLIENT" ? entityId : null,
        notes: body.notes ? String(body.notes) : null,
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
      where: { id: itemId },
      data: { status: "ISSUED" },
    })

    return NextResponse.json(assignment, { status: 201 })
  } catch (error: any) {
    if (String(error?.code) === "P2003") {
      return NextResponse.json({ message: "Invalid relation provided." }, { status: 400 })
    }
    console.error("Error creating inventory assignment:", error)
    return NextResponse.json({ message: "Failed to create assignment." }, { status: 500 })
  }
}

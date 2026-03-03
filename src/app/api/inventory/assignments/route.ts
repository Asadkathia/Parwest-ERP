import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, notFound, unauthorized } from "@/lib/api/response"

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()

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
    return internalServerError("Failed to fetch assignments.")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const body = await request.json()
    const itemId = String(body.itemId || "")
    const assignTo = String(body.assignTo || "")
    const entityId = String(body.entityId || "")

    if (!itemId || !assignTo || !entityId) {
      return badRequest("itemId, assignTo and entityId are required.")
    }
    if (assignTo !== "GUARD" && assignTo !== "CLIENT") {
      return badRequest("assignTo must be GUARD or CLIENT.")
    }

    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      select: { id: true, status: true },
    })
    if (!item) return notFound("Item not found.")
    if (item.status !== "AVAILABLE") {
      return conflict("Item is not available for assignment.")
    }

    const openAssignment = await prisma.inventoryAssignment.findFirst({
      where: {
        itemId,
        returnedAt: null,
      },
      select: { id: true },
    })
    if (openAssignment) {
      return conflict("Item already has an active assignment.")
    }

    if (assignTo === "GUARD") {
      const guard = await prisma.guard.findUnique({
        where: { id: entityId },
        select: { id: true },
      })
      if (!guard) return notFound("Guard not found.")
    } else {
      const client = await prisma.client.findUnique({
        where: { id: entityId },
        select: { id: true },
      })
      if (!client) return notFound("Client not found.")
    }

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
  } catch (error: unknown) {
    if (getPrismaCode(error) === "P2003") {
      return badRequest("Invalid relation provided.")
    }
    console.error("Error creating inventory assignment:", error)
    return internalServerError("Failed to create assignment.")
  }
}

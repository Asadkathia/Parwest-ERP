import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, unauthorized } from "@/lib/api/response"

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const rows = await prisma.inventoryCategory.findMany({
      orderBy: { name: "asc" },
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching inventory categories:", error)
    return internalServerError("Failed to fetch categories.")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const body = await request.json()
    const name = String(body.name || "").trim()
    if (!name) return badRequest("Name is required.")

    const created = await prisma.inventoryCategory.create({
      data: { name },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    if (getPrismaCode(error) === "P2002") {
      return conflict("Category already exists.")
    }
    console.error("Error creating inventory category:", error)
    return internalServerError("Failed to create category.")
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, unauthorized } from "@/lib/api/response"

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const rows = await prisma.inventoryVendor.findMany({
      orderBy: { name: "asc" },
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching inventory vendors:", error)
    return internalServerError("Failed to fetch vendors.")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const body = await request.json()
    const name = String(body.name || "").trim()
    const contact = body.contact ? String(body.contact).trim() : null
    if (!name) return badRequest("Name is required.")

    const created = await prisma.inventoryVendor.create({
      data: { name, contact },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    if (getPrismaCode(error) === "P2002") {
      return conflict("Vendor already exists.")
    }
    console.error("Error creating inventory vendor:", error)
    return internalServerError("Failed to create vendor.")
  }
}

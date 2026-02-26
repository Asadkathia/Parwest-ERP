import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const rows = await prisma.inventoryCategory.findMany({
      orderBy: { name: "asc" },
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching inventory categories:", error)
    return NextResponse.json({ message: "Failed to fetch categories." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const name = String(body.name || "").trim()
    if (!name) return NextResponse.json({ message: "Name is required." }, { status: 400 })

    const created = await prisma.inventoryCategory.create({
      data: { name },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (String(error?.code) === "P2002") {
      return NextResponse.json({ message: "Category already exists." }, { status: 409 })
    }
    console.error("Error creating inventory category:", error)
    return NextResponse.json({ message: "Failed to create category." }, { status: 500 })
  }
}

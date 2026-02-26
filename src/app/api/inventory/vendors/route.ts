import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const rows = await prisma.inventoryVendor.findMany({
      orderBy: { name: "asc" },
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching inventory vendors:", error)
    return NextResponse.json({ message: "Failed to fetch vendors." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const name = String(body.name || "").trim()
    const contact = body.contact ? String(body.contact).trim() : null
    if (!name) return NextResponse.json({ message: "Name is required." }, { status: 400 })

    const created = await prisma.inventoryVendor.create({
      data: { name, contact },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (String(error?.code) === "P2002") {
      return NextResponse.json({ message: "Vendor already exists." }, { status: 409 })
    }
    console.error("Error creating inventory vendor:", error)
    return NextResponse.json({ message: "Failed to create vendor." }, { status: 500 })
  }
}

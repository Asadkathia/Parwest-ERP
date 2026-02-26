import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || undefined
    const categoryId = searchParams.get("categoryId") || undefined
    const vendorId = searchParams.get("vendorId") || undefined
    const search = searchParams.get("search") || undefined

    const where: any = {}
    if (status) where.status = status
    if (categoryId) where.categoryId = categoryId
    if (vendorId) where.vendorId = vendorId
    if (search) {
      where.OR = [
        { uniqueNumber: { contains: search, mode: "insensitive" } },
        { serialNumber: { contains: search, mode: "insensitive" } },
        { orderId: { contains: search, mode: "insensitive" } },
      ]
    }

    const rows = await prisma.inventoryItem.findMany({
      where,
      include: {
        category: true,
        vendor: true,
        regionalOffice: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching inventory items:", error)
    return NextResponse.json({ message: "Failed to fetch inventory items." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const uniqueNumber = String(body.uniqueNumber || "").trim()
    const categoryId = String(body.categoryId || "").trim()
    if (!uniqueNumber || !categoryId) {
      return NextResponse.json({ message: "uniqueNumber and categoryId are required." }, { status: 400 })
    }

    const created = await prisma.inventoryItem.create({
      data: {
        uniqueNumber,
        serialNumber: body.serialNumber ? String(body.serialNumber) : null,
        orderId: body.orderId ? String(body.orderId) : null,
        price: body.price != null ? Number(body.price) : null,
        purchaseDate: body.purchaseDate ? new Date(String(body.purchaseDate)) : null,
        expiryDate: body.expiryDate ? new Date(String(body.expiryDate)) : null,
        warrantyTime: body.warrantyTime ? String(body.warrantyTime) : null,
        warrantyType: body.warrantyType ? String(body.warrantyType) : null,
        size: body.size ? String(body.size) : null,
        weight: body.weight ? String(body.weight) : null,
        length: body.length ? String(body.length) : null,
        width: body.width ? String(body.width) : null,
        color: body.color ? String(body.color) : null,
        isInsured: Boolean(body.isInsured),
        isNonUnique: Boolean(body.isNonUnique),
        quantity: body.quantity != null ? Number(body.quantity) : 1,
        status: body.status ? String(body.status) : "AVAILABLE",
        licenseNumber: body.licenseNumber ? String(body.licenseNumber) : null,
        categoryId,
        vendorId: body.vendorId ? String(body.vendorId) : null,
        regionalOfficeId: body.regionalOfficeId ? String(body.regionalOfficeId) : null,
      },
      include: {
        category: true,
        vendor: true,
        regionalOffice: true,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (String(error?.code) === "P2002") {
      return NextResponse.json({ message: "Unique number already exists." }, { status: 409 })
    }
    console.error("Error creating inventory item:", error)
    return NextResponse.json({ message: "Failed to create inventory item." }, { status: 500 })
  }
}

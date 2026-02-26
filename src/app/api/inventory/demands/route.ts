import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"

const MOCK_ROWS = [
  {
    id: "mock-demand-1",
    quantity: 25,
    status: "PENDING",
    reason: "Uniform shortage",
    requiredBy: "2026-03-10T00:00:00.000Z",
    category: { id: "mock-cat-1", name: "UNIFORM" },
    regionalOffice: { id: "mock-office-lhr", name: "Lahore Head Office" },
    createdAt: "2026-02-24T00:00:00.000Z",
  },
]

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || undefined
    const categoryId = searchParams.get("categoryId") || undefined
    const regionalOfficeId = searchParams.get("regionalOfficeId") || undefined

    if (isMockEnabled()) {
      const rows = MOCK_ROWS.filter((row) => {
        if (status && row.status !== status) return false
        if (categoryId && row.category.id !== categoryId) return false
        if (regionalOfficeId && row.regionalOffice.id !== regionalOfficeId) return false
        return true
      })
      return NextResponse.json(rows)
    }

    const where: any = {}
    if (status) where.status = status
    if (categoryId) where.categoryId = categoryId
    if (regionalOfficeId) where.regionalOfficeId = regionalOfficeId

    const rows = await prisma.inventoryDemand.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        regionalOffice: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    })
    return NextResponse.json(rows)
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) return NextResponse.json({ message: "Schema not migrated for inventory demand yet." }, { status: 503 })
    console.error("Error fetching inventory demands:", error)
    return NextResponse.json({ message: "Failed to fetch demands." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const body = await request.json()
    const quantity = Number(body?.quantity)
    const categoryId = body?.categoryId ? String(body.categoryId) : null
    const regionalOfficeId = body?.regionalOfficeId ? String(body.regionalOfficeId) : null
    const requiredBy = body?.requiredBy ? new Date(String(body.requiredBy)) : null
    const reason = body?.reason ? String(body.reason) : null
    const status = String(body?.status || "PENDING")

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ message: "quantity must be a positive number." }, { status: 400 })
    }
    if (requiredBy && Number.isNaN(requiredBy.getTime())) {
      return NextResponse.json({ message: "Invalid requiredBy date." }, { status: 400 })
    }

    if (isMockEnabled()) {
      return NextResponse.json(
        {
          id: `mock-demand-${Date.now()}`,
          quantity,
          category: categoryId ? { id: categoryId, name: "Category" } : null,
          regionalOffice: regionalOfficeId ? { id: regionalOfficeId, name: "Office" } : null,
          requiredBy: requiredBy?.toISOString() || null,
          reason,
          status,
          createdAt: new Date().toISOString(),
        },
        { status: 201 }
      )
    }

    const created = await prisma.inventoryDemand.create({
      data: {
        quantity,
        categoryId,
        regionalOfficeId,
        requiredBy,
        reason,
        status,
      },
      include: {
        category: { select: { id: true, name: true } },
        regionalOffice: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (isPrismaMissingSchemaError(error)) return NextResponse.json({ message: "Schema not migrated for inventory demand yet." }, { status: 503 })
    if (String(error?.code) === "P2003") return NextResponse.json({ message: "Invalid category or regional office." }, { status: 400 })
    console.error("Error creating inventory demand:", error)
    return NextResponse.json({ message: "Failed to create demand." }, { status: 500 })
  }
}

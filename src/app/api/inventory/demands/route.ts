import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"
import { getPrismaCode, isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, internalServerError, serviceUnavailable, unauthorized } from "@/lib/api/response"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"
import {
  getInventoryDemandStatuses,
  isInitialInventoryDemandStatus,
  normalizeInventoryDemandStatus,
} from "@/lib/inventory/demand-status"

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
    if (!session) return unauthorized()
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

    const where: Prisma.InventoryDemandWhereInput = {}
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
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for inventory demand yet.")
    console.error("Error fetching inventory demands:", error)
    return internalServerError("Failed to fetch demands.")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const body = await request.json()
    const quantity = Number(body?.quantity)
    const categoryId = body?.categoryId ? String(body.categoryId) : null
    const regionalOfficeId = body?.regionalOfficeId ? String(body.regionalOfficeId) : null
    const requiredBy = body?.requiredBy ? new Date(String(body.requiredBy)) : null
    const reason = body?.reason ? String(body.reason) : null
    const status = normalizeInventoryDemandStatus(body?.status || "PENDING")

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return badRequest("quantity must be a positive number.")
    }
    if (requiredBy && Number.isNaN(requiredBy.getTime())) {
      return badRequest("Invalid requiredBy date.")
    }
    if (!status) {
      return badRequest(`Invalid demand status. Allowed values: ${getInventoryDemandStatuses().join(", ")}.`)
    }
    if (isWorkflowRuleEnabled("inventoryDemand.requirePendingInitialStatus") && !isInitialInventoryDemandStatus(status)) {
      return badRequest("New demands must be created with PENDING status.")
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
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for inventory demand yet.")
    if (getPrismaCode(error) === "P2003") return badRequest("Invalid category or regional office.")
    console.error("Error creating inventory demand:", error)
    return internalServerError("Failed to create demand.")
  }
}

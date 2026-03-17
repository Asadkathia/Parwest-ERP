import { NextRequest } from "next/server"
import { Prisma, StoreInventoryMovementType, StoreInventoryPurchaseStatus } from "@prisma/client"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { asText, emitInventoryV2Audit, parseNumberOrNull, parsePositiveInt, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"

const purchaseInclude = {
  store: true,
  createdBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  lines: {
    include: {
      product: true,
    },
  },
}

type PurchaseLineInput = {
  productId: string
  quantity: number
  unitCost: number | null
  notes: string | null
}

function normalizeStatus(raw: unknown): StoreInventoryPurchaseStatus {
  const value = String(raw ?? "RECEIVED").trim().toUpperCase()
  if (value === "DRAFT") return StoreInventoryPurchaseStatus.DRAFT
  if (value === "CANCELLED") return StoreInventoryPurchaseStatus.CANCELLED
  return StoreInventoryPurchaseStatus.RECEIVED
}

function normalizeLines(input: unknown): PurchaseLineInput[] | null {
  if (!Array.isArray(input) || input.length === 0) return null

  const lines: PurchaseLineInput[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null
    const row = raw as Record<string, unknown>
    const productId = String(row.productId ?? "").trim()
    const quantity = parsePositiveInt(row.quantity)
    const unitCost = parseNumberOrNull(row.unitCost)

    if (!productId || quantity == null) return null

    lines.push({
      productId,
      quantity,
      unitCost,
      notes: asText(row.notes),
    })
  }

  return lines
}

export async function GET(request: NextRequest) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get("storeId")?.trim() || undefined
  const status = searchParams.get("status")?.trim() || undefined
  const take = Math.min(Number(searchParams.get("take") ?? "100") || 100, 500)

  try {
    const rows = await prisma.storeInventoryPurchase.findMany({
      where: {
        storeId,
        status: status ? (status as StoreInventoryPurchaseStatus) : undefined,
      },
      include: purchaseInclude,
      orderBy: { createdAt: "desc" },
      take,
    })

    return ok(rows)
  } catch (error) {
    console.error("store-inventory v2 purchases GET failed", error)
    return internalServerError("Failed to fetch purchases.")
  }
}

export async function POST(request: NextRequest) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  try {
    const body = (await request.json()) as Record<string, unknown>
    const storeId = String(body.storeId ?? "").trim()
    const lines = normalizeLines(body.lines)
    const status = normalizeStatus(body.status)

    if (!storeId || !lines) {
      return badRequest("storeId and a non-empty lines array are required.")
    }

    const created = await prisma.$transaction(async (tx) => {
      const createdPurchase = await tx.storeInventoryPurchase.create({
        data: {
          referenceNo: asText(body.referenceNo),
          invoiceNo: asText(body.invoiceNo),
          supplierName: asText(body.supplierName),
          status,
          purchasedAt: body.purchasedAt ? new Date(String(body.purchasedAt)) : undefined,
          receivedAt: status === StoreInventoryPurchaseStatus.RECEIVED ? new Date() : null,
          notes: asText(body.notes),
          storeId,
          createdById: session.userId,
          approvedById: asText(body.approvedById),
          lines: {
            create: lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              unitCost: line.unitCost,
              totalCost: line.unitCost != null ? line.unitCost * line.quantity : null,
              notes: line.notes,
            })),
          },
        },
        include: purchaseInclude,
      })

      if (status !== StoreInventoryPurchaseStatus.CANCELLED) {
        for (const line of createdPurchase.lines) {
          const delta = line.quantity

          const currentBalance = await tx.storeInventoryBalance.findUnique({
            where: {
              storeId_productId: {
                storeId,
                productId: line.productId,
              },
            },
          })

          const nextOnHand = (currentBalance?.quantityOnHand ?? 0) + delta
          const nextAvg =
            line.unitCost == null
              ? currentBalance?.avgUnitCost ?? null
              : currentBalance?.avgUnitCost == null
                ? line.unitCost
                : Number((((currentBalance.avgUnitCost + line.unitCost) / 2).toFixed(2)))

          await tx.storeInventoryBalance.upsert({
            where: {
              storeId_productId: {
                storeId,
                productId: line.productId,
              },
            },
            create: {
              storeId,
              productId: line.productId,
              quantityOnHand: nextOnHand,
              avgUnitCost: nextAvg,
            },
            update: {
              quantityOnHand: nextOnHand,
              avgUnitCost: nextAvg,
            },
          })

          await tx.storeInventoryMovement.create({
            data: {
              movementType: StoreInventoryMovementType.PURCHASE,
              quantity: delta,
              storeId,
              productId: line.productId,
              performedById: session.userId,
              referenceType: "PURCHASE",
              referenceId: createdPurchase.id,
              notes: `Purchase inflow: ${createdPurchase.referenceNo ?? createdPurchase.id}`,
            },
          })
        }
      }

      return createdPurchase
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "PURCHASE_CREATED",
      description: `Created purchase ${created.id} for store ${created.storeId} with ${created.lines.length} line(s)`,
      request,
    })

    return ok(created, 201)
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2002") return conflict("Purchase reference must be unique.")
    if (code === "P2003") return badRequest("Invalid store, user, or product reference.")

    console.error("store-inventory v2 purchases POST failed", error)
    return internalServerError("Failed to create purchase.")
  }
}

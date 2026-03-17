import { NextRequest } from "next/server"
import { Prisma, StoreInventoryAdjustmentType, StoreInventoryMovementType } from "@prisma/client"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, internalServerError, notFound, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { asText, emitInventoryV2Audit, parseNumberOrNull, parsePositiveInt, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"

const adjustmentInclude = {
  store: true,
  createdBy: { select: { id: true, name: true, email: true } },
  lines: {
    include: {
      product: true,
    },
  },
}

type AdjustmentLineInput = {
  productId: string
  quantity: number
  unitCost: number | null
  notes: string | null
}

function normalizeType(raw: unknown): StoreInventoryAdjustmentType | null {
  const value = String(raw ?? "").trim().toUpperCase()
  if (value === "INCREASE") return StoreInventoryAdjustmentType.INCREASE
  if (value === "DECREASE") return StoreInventoryAdjustmentType.DECREASE
  if (value === "SET") return StoreInventoryAdjustmentType.SET
  return null
}

function normalizeLines(input: unknown): AdjustmentLineInput[] | null {
  if (!Array.isArray(input) || input.length === 0) return null

  const lines: AdjustmentLineInput[] = []
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
  const adjustmentType = searchParams.get("adjustmentType")?.trim() || undefined

  try {
    const rows = await prisma.storeInventoryAdjustment.findMany({
      where: {
        storeId,
        adjustmentType: adjustmentType ? (adjustmentType as StoreInventoryAdjustmentType) : undefined,
      },
      include: adjustmentInclude,
      orderBy: { createdAt: "desc" },
      take: 500,
    })

    return ok(rows)
  } catch (error) {
    console.error("store-inventory v2 adjustments GET failed", error)
    return internalServerError("Failed to fetch adjustments.")
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
    const adjustmentType = normalizeType(body.adjustmentType)
    const lines = normalizeLines(body.lines)

    if (!storeId || !adjustmentType || !lines) {
      return badRequest("storeId, adjustmentType, and non-empty lines are required.")
    }

    const created = await prisma.$transaction(async (tx) => {
      const createdAdjustment = await tx.storeInventoryAdjustment.create({
        data: {
          storeId,
          adjustmentType,
          reason: asText(body.reason),
          notes: asText(body.notes),
          adjustedAt: body.adjustedAt ? new Date(String(body.adjustedAt)) : undefined,
          createdById: session.userId,
        },
      })

      const createdLines: Array<{ productId: string; quantityDelta: number }> = []

      for (const line of lines) {
        const current =
          await tx.storeInventoryBalance.findUnique({
            where: {
              storeId_productId: {
                storeId,
                productId: line.productId,
              },
            },
          })

        const before = current?.quantityOnHand ?? 0
        const delta =
          adjustmentType === StoreInventoryAdjustmentType.INCREASE
            ? line.quantity
            : adjustmentType === StoreInventoryAdjustmentType.DECREASE
              ? -line.quantity
              : line.quantity - before
        const after = before + delta

        if (after < 0) {
          throw new Error(`Insufficient stock for product ${line.productId}`)
        }

        await tx.storeInventoryAdjustmentLine.create({
          data: {
            adjustmentId: createdAdjustment.id,
            productId: line.productId,
            quantityBefore: before,
            quantityDelta: delta,
            quantityAfter: after,
            unitCost: line.unitCost,
            notes: line.notes,
          },
        })

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
            quantityOnHand: after,
            avgUnitCost: line.unitCost,
          },
          update: {
            quantityOnHand: after,
            avgUnitCost: line.unitCost ?? current?.avgUnitCost ?? null,
          },
        })

        await tx.storeInventoryMovement.create({
          data: {
            movementType: delta >= 0 ? StoreInventoryMovementType.ADJUSTMENT_IN : StoreInventoryMovementType.ADJUSTMENT_OUT,
            quantity: Math.abs(delta),
            storeId,
            productId: line.productId,
            performedById: session.userId,
            referenceType: "ADJUSTMENT",
            referenceId: createdAdjustment.id,
            notes: `Adjustment ${adjustmentType}`,
          },
        })

        createdLines.push({ productId: line.productId, quantityDelta: delta })
      }

      return tx.storeInventoryAdjustment.findUnique({
        where: { id: createdAdjustment.id },
        include: adjustmentInclude,
      })
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    if (!created) return notFound("Adjustment not found after creation.")

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "ADJUSTMENT_CREATED",
      description: `Created adjustment ${created.id} for store ${created.storeId}`,
      request,
    })

    return ok(created, 201)
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2003") return badRequest("Invalid store, user, or product reference.")

    const message = error instanceof Error ? error.message : "Failed to create adjustment."
    if (message.toLowerCase().includes("insufficient stock")) {
      return badRequest(message)
    }

    console.error("store-inventory v2 adjustments POST failed", error)
    return internalServerError("Failed to create adjustment.")
  }
}

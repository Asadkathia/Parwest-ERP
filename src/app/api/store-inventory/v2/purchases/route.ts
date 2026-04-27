import { NextRequest } from "next/server"
import { Prisma, StoreInventoryMovementType, StoreInventoryPurchaseStatus } from "@prisma/client"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { asText, buildStoreScopeWhere, emitInventoryV2Audit, ensureStoreInScope, parseNumberOrNull, parsePositiveInt, readScopedRegionParams, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"
import { parsePurchaseNotes, serializePurchaseNotes } from "@/lib/inventory/purchase-workflow-meta"
import { isWeaponCategoryName, normalizeCategoryScope } from "@/lib/inventory/store-v2-validators"

const purchaseInclude = {
  store: true,
  vendor: true,
  createdBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  lines: {
    include: {
      product: true,
    },
  },
}
const legacyPurchaseInclude = {
  store: true,
  createdBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  lines: {
    include: {
      product: true,
    },
  },
}
const legacyPurchaseSelectBase = {
  id: true,
  referenceNo: true,
  invoiceNo: true,
  supplierName: true,
  status: true,
  purchasedAt: true,
  receivedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  storeId: true,
  createdById: true,
  approvedById: true,
}

type PurchaseLineInput = {
  productId: string
  quantity: number
  unitCost: number | null
  notes: string | null
}

function normalizeStatus(raw: unknown): StoreInventoryPurchaseStatus {
  const value = String(raw ?? "DRAFT").trim().toUpperCase()
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

  const scopeParams = readScopedRegionParams(request, session.scope)
  if (scopeParams instanceof Response) return scopeParams

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get("storeId")?.trim() || undefined
  const status = searchParams.get("status")?.trim() || undefined
  const categoryScope = normalizeCategoryScope(searchParams.get("categoryScope"))
  const take = Math.min(Number(searchParams.get("take") ?? "100") || 100, 500)

  // Stores hold `regionalOfficeId` only — region scope flows through that relation.
  const storeOfficeFilter = buildStoreScopeWhere(session.scope, scopeParams.regionalOfficeId, scopeParams.regionId)

  try {
    const where: Prisma.StoreInventoryPurchaseWhereInput = {
      storeId,
      status: status ? (status as StoreInventoryPurchaseStatus) : undefined,
      ...(storeOfficeFilter ? { store: { is: storeOfficeFilter } } : {}),
      ...(categoryScope === "WEAPON"
        ? {
            lines: {
              some: {
                product: {
                  category: {
                    is: {
                      OR: [
                        { name: { contains: "weapon", mode: "insensitive" } },
                        { name: { contains: "ammo", mode: "insensitive" } },
                      ],
                    },
                  },
                },
              },
            },
          }
        : {
            NOT: {
              lines: {
                some: {
                  product: {
                    category: {
                      is: {
                        OR: [
                          { name: { contains: "weapon", mode: "insensitive" } },
                          { name: { contains: "ammo", mode: "insensitive" } },
                        ],
                      },
                    },
                  },
                },
              },
            },
          }),
    }
    let rows
    try {
      rows = await prisma.storeInventoryPurchase.findMany({
        where,
        include: purchaseInclude,
        orderBy: { createdAt: "desc" },
        take,
      })
    } catch (error) {
      const code = getPrismaCode(error)
      const message = error instanceof Error ? error.message : ""
      if (message.includes("Unknown field `vendor`") || code === "P2022" || code === "P2021") {
        rows = await prisma.storeInventoryPurchase.findMany({
          where,
          select: {
            ...legacyPurchaseSelectBase,
            store: true,
            createdBy: { select: { id: true, name: true, email: true } },
            approvedBy: { select: { id: true, name: true, email: true } },
            lines: { include: { product: true } },
          },
          orderBy: { createdAt: "desc" },
          take,
        } as Prisma.StoreInventoryPurchaseFindManyArgs)
      } else {
        throw error
      }
    }

    const normalizedRows = (rows as Array<Record<string, unknown>>).map((row) => {
      const decoded = parsePurchaseNotes(row.notes as string | null | undefined)
      return {
        ...row,
        notes: decoded.note,
        purchaseOrder: decoded.purchaseOrder,
        workflow: decoded.workflow,
      }
    })

    return ok(normalizedRows)
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
    const categoryScope = normalizeCategoryScope(body.categoryScope)

    const note = asText(body.note ?? body.notes)
    const poMeta = {
      approvalReference: asText(body.approvalReference),
      invoiceDate: asText(body.invoiceDate),
      deliveryChallanNumber: asText(body.deliveryChallanNumber),
    }

    if (!storeId || !lines) {
      return badRequest("storeId and a non-empty lines array are required.")
    }

    const storeDenied = await ensureStoreInScope(storeId, session.scope)
    if (storeDenied) return storeDenied

    const lineProductIds = Array.from(new Set(lines.map((line) => line.productId)))
    const selectedProducts = await prisma.storeInventoryProduct.findMany({
      where: { id: { in: lineProductIds } },
      select: {
        id: true,
        category: { select: { name: true } },
      },
    })
    if (categoryScope === "WEAPON") {
      const nonWeaponProduct = selectedProducts.find((product) => !isWeaponCategoryName(product.category?.name))
      if (nonWeaponProduct) {
        return badRequest("Only weapon/ammo category products are allowed in weapon purchases.")
      }
    } else {
      const invalidWeaponProduct = selectedProducts.find((product) => isWeaponCategoryName(product.category?.name))
      if (invalidWeaponProduct) {
        return badRequest("Weapon/ammo category products are restricted from Store/Warehouse purchases.")
      }
    }
    if (selectedProducts.length !== lineProductIds.length) {
      return badRequest("One or more selected products are invalid.")
    }

    const created = await prisma.$transaction(async (tx) => {
      const baseData: Prisma.StoreInventoryPurchaseUncheckedCreateInput = {
        referenceNo: asText(body.referenceNo),
        invoiceNo: asText(body.invoiceNo ?? body.invoiceNumber),
        attachmentUrl: asText(body.attachmentUrl),
        supplierName: asText(body.supplierName),
        vendorId: asText(body.vendorId),
        status,
        purchasedAt: body.purchasedAt ? new Date(String(body.purchasedAt)) : undefined,
        receivedAt: status === StoreInventoryPurchaseStatus.RECEIVED ? new Date() : null,
        notes: serializePurchaseNotes({
          note,
          purchaseOrder: poMeta,
          workflow: {
            history: [
              {
                status: status === StoreInventoryPurchaseStatus.RECEIVED ? "RECEIVED" : "PENDING",
                changedByUserId: session.userId,
                changedByName: null,
                changedAt: new Date().toISOString(),
                remarks: "Purchase created",
              },
            ],
          },
        }),
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
      }
      type CreatedPurchase = Prisma.StoreInventoryPurchaseGetPayload<{ include: typeof purchaseInclude }>
      let createdPurchase: CreatedPurchase
      try {
        createdPurchase = (await tx.storeInventoryPurchase.create({
          data: baseData,
          include: purchaseInclude as Prisma.StoreInventoryPurchaseInclude,
        })) as unknown as CreatedPurchase
      } catch (error) {
        const message = error instanceof Error ? error.message : ""
        if (
          !message.includes("Unknown argument `vendorId`") &&
          !message.includes("Unknown argument `attachmentUrl`") &&
          !message.includes("Unknown field `vendor`")
        ) {
          throw error
        }
        const fallbackData: Record<string, unknown> = { ...baseData }
        delete fallbackData.vendorId
        delete fallbackData.attachmentUrl
        createdPurchase = (await tx.storeInventoryPurchase.create({
          data: fallbackData as Prisma.StoreInventoryPurchaseUncheckedCreateInput,
          include: legacyPurchaseInclude as Prisma.StoreInventoryPurchaseInclude,
        })) as unknown as CreatedPurchase
      }

      if (status === StoreInventoryPurchaseStatus.RECEIVED) {
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

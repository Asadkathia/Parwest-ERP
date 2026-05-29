import { NextRequest } from "next/server"
import { StoreInventoryDemandStatus } from "@prisma/client"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { asText, buildStoreScopeWhere, emitInventoryV2Audit, ensureStoreInScope, parsePositiveInt, readScopedRegionParams, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"
import { isWeaponCategoryName } from "@/lib/inventory/store-v2-validators"
import { isInitialDemandStatus, normalizeDemandStatus } from "@/lib/inventory/demand-status-machine"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"

const demandInclude = {
  fromStore: true,
  toStore: true,
  requestedBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  lines: {
    include: {
      product: true,
    },
  },
  responses: {
    include: {
      responderStore: true,
      responder: { select: { id: true, name: true, email: true } },
      lines: true,
    },
  },
}

type DemandLineInput = {
  productId: string
  requestedQty: number
  notes: string | null
}

function normalizeLines(input: unknown): DemandLineInput[] | null {
  if (!Array.isArray(input) || input.length === 0) return null
  const lines: DemandLineInput[] = []

  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null
    const line = raw as Record<string, unknown>
    const productId = String(line.productId ?? "").trim()
    const requestedQty = parsePositiveInt(line.requestedQty)
    if (!productId || requestedQty == null) return null

    lines.push({
      productId,
      requestedQty,
      notes: asText(line.notes),
    })
  }

  return lines
}

function normalizeStoreKind(raw: unknown): "STORE" | "WAREHOUSE" | "UNKNOWN" {
  const value = String(raw ?? "").trim().toUpperCase()
  if (value === "STORE") return "STORE"
  if (value === "WAREHOUSE") return "WAREHOUSE"
  if (value.includes("WAREHOUSE")) return "WAREHOUSE"
  if (value.includes("STORE")) return "STORE"
  return "UNKNOWN"
}

export async function GET(request: NextRequest) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const scopeParams = readScopedRegionParams(request, session.scope)
  if (scopeParams instanceof Response) return scopeParams

  const { searchParams } = new URL(request.url)
  const rawStatus = searchParams.get("status")?.trim()
  const status = rawStatus ? normalizeDemandStatus(rawStatus) : null
  if (rawStatus && !status) {
    return badRequest("Invalid demand status filter.")
  }
  const fromStoreId = searchParams.get("fromStoreId")?.trim() || undefined
  const toStoreId = searchParams.get("toStoreId")?.trim() || undefined

  const storeOfficeFilter = buildStoreScopeWhere(session.scope, scopeParams.regionalOfficeId, scopeParams.regionId)

  try {
    const rows = await prisma.storeInventoryDemand.findMany({
      where: {
        status: status ?? undefined,
        fromStoreId,
        toStoreId,
        ...(storeOfficeFilter
          ? {
              OR: [
                { fromStore: { is: storeOfficeFilter } },
                { toStore: { is: storeOfficeFilter } },
              ],
            }
          : {}),
      },
      include: demandInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    return ok(rows)
  } catch (error) {
    console.error("store-inventory v2 demands GET failed", error)
    return internalServerError("Failed to fetch demands.")
  }
}

export async function POST(request: NextRequest) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  try {
    const body = (await request.json()) as Record<string, unknown>
    const lines = normalizeLines(body.lines)
    // Workflow rule `inventoryDemand.requirePendingInitialStatus`:
    //   ENABLED  → restrict create to an initial state (DRAFT or SENT, per
    //              INITIAL_DEMAND_STATUSES). Any later state must be reached
    //              through the PATCH transition gate, never set directly on
    //              create. This is the documented "pending" meaning.
    //   DISABLED → allow any normalized status on create (still reject
    //              unrecognized values).
    // Default status when none supplied remains SENT for backward compat.
    const status =
      body.status == null ? StoreInventoryDemandStatus.SENT : normalizeDemandStatus(body.status)
    if (status == null) {
      return badRequest("Invalid demand status.")
    }
    if (
      isWorkflowRuleEnabled("inventoryDemand.requirePendingInitialStatus") &&
      !isInitialDemandStatus(status)
    ) {
      return badRequest("New demands may only be created as DRAFT or SENT.")
    }
    const fromStoreId = asText(body.fromStoreId)
    const toStoreId = asText(body.toStoreId)

    if (!lines) return badRequest("Demand lines are required.")
    if (!fromStoreId || !toStoreId) {
      return badRequest("fromStoreId and toStoreId are required.")
    }

    // Demand creator must have scope over BOTH source store and destination warehouse.
    const fromDenied = await ensureStoreInScope(fromStoreId, session.scope)
    if (fromDenied) return fromDenied
    const toDenied = await ensureStoreInScope(toStoreId, session.scope)
    if (toDenied) return toDenied

    const lineProductIds = Array.from(new Set(lines.map((line) => line.productId)))
    const selectedProducts = await prisma.storeInventoryProduct.findMany({
      where: { id: { in: lineProductIds } },
      select: {
        id: true,
        category: { select: { name: true } },
      },
    })
    const invalidWeaponProduct = selectedProducts.find((product) => isWeaponCategoryName(product.category?.name))
    if (invalidWeaponProduct) {
      return badRequest("Weapon/ammo category products are restricted from Store/Warehouse demands.")
    }
    if (selectedProducts.length !== lineProductIds.length) {
      return badRequest("One or more selected products are invalid.")
    }

    const [fromStore, toStore] = await Promise.all([
      prisma.store.findUnique({ where: { id: fromStoreId }, select: { id: true, type: true } }),
      prisma.store.findUnique({ where: { id: toStoreId }, select: { id: true, type: true } }),
    ])

    if (!fromStore || !toStore) {
      return badRequest("Invalid fromStoreId or toStoreId.")
    }

    const fromKind = normalizeStoreKind(fromStore.type)
    const toKind = normalizeStoreKind(toStore.type)
    if (fromKind !== "STORE" || toKind !== "WAREHOUSE") {
      return badRequest("Demand flow must be Store -> Warehouse.")
    }

    const created = await prisma.storeInventoryDemand.create({
      data: {
        requestNo: asText(body.requestNo),
        status,
        requiredBy: body.requiredBy ? new Date(String(body.requiredBy)) : null,
        reason: asText(body.reason),
        notes: asText(body.notes),
        fromStoreId,
        toStoreId,
        requestedById: session.userId,
        approvedById: null,
        lines: {
          create: lines.map((line) => ({
            productId: line.productId,
            requestedQty: line.requestedQty,
            notes: line.notes,
          })),
        },
      },
      include: demandInclude,
    })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "DEMAND_CREATED",
      description: `Created demand ${created.id}`,
      request,
    })

    return ok(created, 201)
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2002") return conflict("Demand request number must be unique.")
    if (code === "P2003") return badRequest("Invalid user/store/product reference.")

    console.error("store-inventory v2 demands POST failed", error)
    return internalServerError("Failed to create demand.")
  }
}

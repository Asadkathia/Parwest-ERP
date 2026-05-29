import { NextRequest } from "next/server"
import {
  Prisma,
  StoreInventoryAssignmentStatus,
  StoreInventoryAssignmentTargetType,
  StoreInventoryMovementType,
} from "@prisma/client"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, internalServerError, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { asText, buildStoreScopeWhere, emitInventoryV2Audit, ensureClientInScope, ensureGuardInScope, ensureStoreInScope, ensureUserInScope, parsePositiveInt, readScopedRegionParams, rejectCrossOffice, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"
import { isWeaponCategoryName, normalizeCategoryScope } from "@/lib/inventory/store-v2-validators"
import { applyStockMovement, availableQty } from "@/lib/inventory/stock-movement"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const assignmentInclude: any = {
  store: true,
  product: true,
  condition: true,
  assignedToGuard: { select: { id: true, name: true, parwestId: true, cnic: true } },
  assignedToClient: { select: { id: true, name: true, type: true } },
  assignedToUser: { select: { id: true, name: true, email: true } },
  assignedByUser: { select: { id: true, name: true, email: true } },
  returnedByUser: { select: { id: true, name: true, email: true } },
}

type AssignmentLineInput = {
  productId: string
  quantity: number
  conditionId: string | null
  notes: string | null
}

function normalizeLines(body: Record<string, unknown>): AssignmentLineInput[] | null {
  if (Array.isArray(body.lines) && body.lines.length > 0) {
    const lines: AssignmentLineInput[] = []
    for (const raw of body.lines) {
      if (!raw || typeof raw !== "object") return null
      const row = raw as Record<string, unknown>
      const productId = String(row.productId ?? "").trim()
      const quantity = parsePositiveInt(row.quantity)
      if (!productId || quantity == null) return null
      lines.push({
        productId,
        quantity,
        conditionId: asText(row.conditionId),
        notes: asText(row.notes),
      })
    }
    return lines
  }

  const productId = String(body.productId ?? "").trim()
  const quantity = parsePositiveInt(body.quantity)
  if (!productId || quantity == null) return null
  return [
    {
      productId,
      quantity,
      conditionId: asText(body.conditionId),
      notes: asText(body.notes),
    },
  ]
}

function normalizeAssignedToType(value: unknown): StoreInventoryAssignmentTargetType {
  const raw = String(value ?? "").trim().toUpperCase()
  if (raw === "GUARD") return StoreInventoryAssignmentTargetType.GUARD
  if (raw === "CLIENT") return StoreInventoryAssignmentTargetType.CLIENT
  return StoreInventoryAssignmentTargetType.EMPLOYEE
}

export async function GET(request: NextRequest) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const scopeParams = readScopedRegionParams(request, session.scope)
  if (scopeParams instanceof Response) return scopeParams

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")?.trim() || undefined
  const assignedToType = searchParams.get("assignedToType")?.trim().toUpperCase() || undefined
  const assignedToUserId = searchParams.get("assignedToUserId")?.trim() || undefined
  const assignedToGuardId = searchParams.get("assignedToGuardId")?.trim() || undefined
  const assignedToClientId = searchParams.get("assignedToClientId")?.trim() || undefined
  const storeId = searchParams.get("storeId")?.trim() || undefined
  const categoryScope = normalizeCategoryScope(searchParams.get("categoryScope"))

  const storeOfficeFilter = buildStoreScopeWhere(session.scope, scopeParams.regionalOfficeId, scopeParams.regionId)

  try {
    const rows = await prisma.storeInventoryAssignment.findMany({
      where: {
        status: status ? (status as StoreInventoryAssignmentStatus) : undefined,
        assignedToType: assignedToType ? (assignedToType as StoreInventoryAssignmentTargetType) : undefined,
        assignedToUserId,
        assignedToGuardId,
        assignedToClientId,
        storeId,
        ...(storeOfficeFilter ? { store: { is: storeOfficeFilter } } : {}),
        ...(categoryScope === "WEAPON"
          ? {
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
            }
          : {
              NOT: {
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
            }),
      },
      include: assignmentInclude,
      orderBy: { assignedAt: "desc" },
      take: 500,
    })

    return ok(rows)
  } catch (error) {
    console.error("store-inventory v2 assignments GET failed", error)
    return internalServerError("Failed to fetch assignments.")
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
    const assignedToType = normalizeAssignedToType(body.assignedToType)
    const assignedToUserId = String(body.assignedToUserId ?? "").trim()
    const assignedToGuardId = String(body.assignedToGuardId ?? "").trim()
    const assignedToClientId = String(body.assignedToClientId ?? "").trim()
    const assignedAtRaw = String(body.assignedAt ?? "").trim()
    const assignedAt = assignedAtRaw ? new Date(assignedAtRaw) : new Date()
    const remarks = asText(body.remarks)
    const lines = normalizeLines(body)
    const categoryScope = normalizeCategoryScope(body.categoryScope)

    if (Number.isNaN(assignedAt.getTime())) {
      return badRequest("Invalid assignedAt date.")
    }

    if (!storeId || !lines) {
      return badRequest("storeId and non-empty assignment lines are required.")
    }

    if (assignedToType === StoreInventoryAssignmentTargetType.EMPLOYEE && !assignedToUserId) {
      return badRequest("assignedToUserId is required for employee assignments.")
    }
    if (assignedToType === StoreInventoryAssignmentTargetType.GUARD && !assignedToGuardId) {
      return badRequest("assignedToGuardId is required for guard assignments.")
    }
    if (assignedToType === StoreInventoryAssignmentTargetType.CLIENT && !assignedToClientId) {
      return badRequest("assignedToClientId is required for client assignments.")
    }

    // Source store must be within the user's scope.
    const storeDenied = await ensureStoreInScope(storeId, session.scope)
    if (storeDenied) return storeDenied

    // Target guard/employee/client must also be within the user's scope.
    if (assignedToType === StoreInventoryAssignmentTargetType.GUARD && assignedToGuardId) {
      const guardDenied = await ensureGuardInScope(assignedToGuardId, session.scope)
      if (guardDenied) return guardDenied
    } else if (assignedToType === StoreInventoryAssignmentTargetType.CLIENT && assignedToClientId) {
      const clientDenied = await ensureClientInScope(assignedToClientId, session.scope)
      if (clientDenied) return clientDenied
    } else if (assignedToType === StoreInventoryAssignmentTargetType.EMPLOYEE && assignedToUserId) {
      const userDenied = await ensureUserInScope(assignedToUserId, session.scope)
      if (userDenied) return userDenied
    }

    // Cross-region assignment guard: source store and target entity must share
    // a regional office. Enforced for ALL users (incl. SuperAdmin) — inventory
    // cannot move between regions even for unrestricted operators.
    if (assignedToType === StoreInventoryAssignmentTargetType.GUARD && assignedToGuardId) {
      const [assignStore, assignGuard] = await Promise.all([
        prisma.store.findUnique({
          where: { id: storeId },
          select: { regionalOfficeId: true, name: true },
        }),
        prisma.guard.findUnique({
          where: { id: assignedToGuardId },
          select: { regionalOfficeId: true, name: true },
        }),
      ])
      if (!assignGuard) return badRequest("Guard not found.")
      const reason = rejectCrossOffice(
        assignStore?.regionalOfficeId,
        assignGuard.regionalOfficeId,
        assignGuard.name,
        "guard",
      )
      if (reason) return badRequest(reason)
    }
    if (assignedToType === StoreInventoryAssignmentTargetType.CLIENT && assignedToClientId) {
      const [assignStore, assignClient] = await Promise.all([
        prisma.store.findUnique({
          where: { id: storeId },
          select: { regionalOfficeId: true },
        }),
        prisma.client.findUnique({
          where: { id: assignedToClientId },
          select: { regionalOfficeId: true, name: true },
        }),
      ])
      if (!assignClient) return badRequest("Client not found.")
      const reason = rejectCrossOffice(
        assignStore?.regionalOfficeId,
        assignClient.regionalOfficeId,
        assignClient.name,
        "client",
      )
      if (reason) return badRequest(reason)
    }
    if (assignedToType === StoreInventoryAssignmentTargetType.EMPLOYEE && assignedToUserId) {
      const [assignStore, assignUser] = await Promise.all([
        prisma.store.findUnique({
          where: { id: storeId },
          select: { regionalOfficeId: true },
        }),
        prisma.user.findUnique({
          where: { id: assignedToUserId },
          select: { regionalOfficeId: true, name: true },
        }),
      ])
      if (!assignUser) return badRequest("Employee not found.")
      const reason = rejectCrossOffice(
        assignStore?.regionalOfficeId,
        assignUser.regionalOfficeId,
        assignUser.name ?? assignedToUserId,
        "employee",
      )
      if (reason) return badRequest(reason)
    }

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
        return badRequest("Only weapon/ammo category products are allowed in weapon assignments.")
      }
    } else {
      const invalidWeaponProduct = selectedProducts.find((product) => isWeaponCategoryName(product.category?.name))
      if (invalidWeaponProduct) {
        return badRequest("Weapon/ammo category products are restricted from this assignment flow.")
      }
    }
    if (selectedProducts.length !== lineProductIds.length) {
      return badRequest("One or more selected products are invalid.")
    }

    const created = await prisma.$transaction(async (tx) => {
      const createdAssignments: Array<Record<string, unknown>> = []

      for (const line of lines) {
        const balance = await tx.storeInventoryBalance.findUnique({
          where: {
            storeId_productId: {
              storeId,
              productId: line.productId,
            },
          },
        })

        // Availability excludes held + already-issued stock — held inventory is
        // reserved and must not be assignable.
        if (availableQty(balance) < line.quantity) {
          throw new Error(`INSUFFICIENT_STOCK:${line.productId}`)
        }

        await applyStockMovement(tx, {
          storeId,
          productId: line.productId,
          onHandDelta: -line.quantity,
          issuedDelta: line.quantity,
        })

        const assignmentData = {
          storeId,
          productId: line.productId,
          conditionId: line.conditionId,
          assignedToType,
          assignedToUserId:
            assignedToType === StoreInventoryAssignmentTargetType.EMPLOYEE ? assignedToUserId : null,
          assignedToGuardId:
            assignedToType === StoreInventoryAssignmentTargetType.GUARD ? assignedToGuardId : null,
          assignedToClientId:
            assignedToType === StoreInventoryAssignmentTargetType.CLIENT ? assignedToClientId : null,
          assignedByUserId: session.userId,
          quantity: line.quantity,
          status: StoreInventoryAssignmentStatus.ASSIGNED,
          assignedAt,
          expectedReturnAt: body.expectedReturnAt ? new Date(String(body.expectedReturnAt)) : null,
          notes: line.notes ?? remarks ?? asText(body.notes),
        }

        const createdAssignment = await tx.storeInventoryAssignment.create({
          data: assignmentData,
          include: assignmentInclude,
        })

        await tx.storeInventoryMovement.create({
          data: {
            movementType: StoreInventoryMovementType.ASSIGNMENT_OUT,
            quantity: line.quantity,
            storeId,
            productId: line.productId,
            performedById: session.userId,
            referenceType: "ASSIGNMENT",
            referenceId: createdAssignment.id,
            notes:
              assignedToType === StoreInventoryAssignmentTargetType.GUARD
                ? `Assignment checkout to guard ${assignedToGuardId}`
                : assignedToType === StoreInventoryAssignmentTargetType.CLIENT
                  ? `Assignment checkout to client ${assignedToClientId}`
                  : `Assignment checkout to employee ${assignedToUserId}`,
          },
        })

        createdAssignments.push(createdAssignment as unknown as Record<string, unknown>)
      }

      return createdAssignments
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "ASSIGNMENT_CREATED",
      description:
        assignedToType === StoreInventoryAssignmentTargetType.GUARD
          ? `Created ${created.length} guard assignment line(s) for guard ${assignedToGuardId}`
          : assignedToType === StoreInventoryAssignmentTargetType.CLIENT
            ? `Created ${created.length} client assignment line(s) for client ${assignedToClientId}`
            : `Created ${created.length} employee assignment line(s) for user ${assignedToUserId}`,
      request,
    })

    return ok(created, 201)
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2003") {
      return badRequest("Invalid store/product/condition/assignee reference.")
    }
    if (error instanceof Error && error.message.startsWith("INSUFFICIENT_STOCK")) {
      return badRequest("Insufficient stock available for one or more assignment lines.")
    }

    console.error("store-inventory v2 assignments POST failed", error)
    return internalServerError("Failed to create assignment.")
  }
}

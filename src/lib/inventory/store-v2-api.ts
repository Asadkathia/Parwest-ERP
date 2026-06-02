import { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { hasModuleAccess } from "@/lib/api/permissions"
import { prisma } from "@/lib/db"
import { forbidden, notFound, unauthorized, type ApiEnvelope } from "@/lib/api/response"
import { getInventoryV2Flags } from "@/lib/inventory/v2-flags"
import { getPrismaCode } from "@/lib/prisma-errors"
import { deriveManagerScope, managerScopeDenied, type ManagerScope } from "@/lib/access/scope"
import { clientInScope } from "@/lib/clients/access"

type SessionUser = {
  id?: string
  role?: string
}

export type AuthedContext = {
  userId: string
  role: string
  scope: ManagerScope | null
}

export async function requireInventorySession(): Promise<AuthedContext | Response> {
  const session = await auth()
  if (!session?.user) return unauthorized()

  const user = session.user as SessionUser
  if (!user.id) return unauthorized("Authenticated user id not found in session")

  if (!hasModuleAccess(session, "INVENTORY")) return forbidden()

  return {
    userId: user.id,
    role: typeof user.role === "string" ? user.role : "UNKNOWN",
    scope: deriveManagerScope(session),
  }
}

/**
 * Read region/regionalOffice URL params and reject if outside scope.
 * Returns parsed values for the route to merge into Prisma where clauses,
 * or a 403 Response if the request asks for data outside the user's scope.
 */
export function readScopedRegionParams(
  request: NextRequest,
  scope: ManagerScope | null
): { regionId: string | null; regionalOfficeId: string | null } | Response {
  const { searchParams } = new URL(request.url)
  const regionId = searchParams.get("regionId")
  const regionalOfficeId = searchParams.get("regionalOfficeId")
  if (managerScopeDenied(scope, { regionId, regionalOfficeId })) {
    return forbidden("Forbidden: requested scope is outside your assigned region.")
  }
  return { regionId, regionalOfficeId }
}

/**
 * Build a `Prisma.StoreWhereInput` fragment that filters Stores down to the
 * user's regional scope, layered with optional URL-level region/office filters
 * (the page-level RegionUrlPicker writes both into the query string).
 *
 * Precedence:
 *   1. URL-requested `regionalOfficeId` (most specific)
 *   2. Session scope's `regionalOfficeIds` (regional-office user)
 *   3. URL-requested `regionId` (SuperAdmin filtering via picker)
 *   4. Session scope's `regionId` (regional user)
 *   5. No filter (SuperAdmin with no picker selection)
 *
 * Returns `undefined` when no filter is needed.
 */
export function buildStoreScopeWhere(
  scope: ManagerScope | null,
  requestedOfficeId?: string | null,
  requestedRegionId?: string | null,
): Prisma.StoreWhereInput | undefined {
  const officeIds = scope?.regionalOfficeIds ?? []
  const scopeRegionId = scope?.regionId ?? null
  if (requestedOfficeId) return { regionalOfficeId: requestedOfficeId }
  if (officeIds.length === 1) return { regionalOfficeId: officeIds[0] }
  if (officeIds.length > 1) return { regionalOfficeId: { in: officeIds } }
  if (requestedRegionId) return { regionalOffice: { is: { regionId: requestedRegionId } } }
  if (scopeRegionId) return { regionalOffice: { is: { regionId: scopeRegionId } } }
  return undefined
}

/**
 * Verify a regionalOfficeId is within the user's scope.
 * Returns null if allowed (or scope is null/SuperAdmin), or a forbidden Response.
 */
export async function ensureRegionalOfficeInScope(
  regionalOfficeId: string | null | undefined,
  scope: ManagerScope | null,
): Promise<Response | null> {
  if (!scope) return null
  const officeId = regionalOfficeId?.trim() || null
  const allowedOffices = scope.regionalOfficeIds
  if (allowedOffices.length > 0) {
    if (!officeId || !allowedOffices.includes(officeId)) {
      return forbidden("Forbidden: target is outside your assigned regional office.")
    }
    return null
  }
  if (scope.regionId) {
    if (!officeId) {
      return forbidden("Forbidden: a regional office is required for users scoped to a region.")
    }
    const office = await prisma.regionalOffice.findUnique({
      where: { id: officeId },
      select: { regionId: true },
    })
    if (!office || office.regionId !== scope.regionId) {
      return forbidden("Forbidden: target is outside your assigned region.")
    }
  }
  return null
}

/**
 * Verify a Store is within the user's regional scope. Returns null if
 * allowed/SuperAdmin, a notFound if the store doesn't exist, or a forbidden
 * Response if the store is outside scope.
 */
export async function ensureStoreInScope(
  storeId: string | null | undefined,
  scope: ManagerScope | null,
  notFoundMessage = "Store not found.",
): Promise<Response | null> {
  const id = storeId?.trim()
  if (!id) return notFound(notFoundMessage)
  if (!scope) return null
  const store = await prisma.store.findUnique({
    where: { id },
    select: { regionalOfficeId: true, regionalOffice: { select: { regionId: true } } },
  })
  if (!store) return notFound(notFoundMessage)
  if (scope.regionalOfficeIds.length > 0) {
    if (!store.regionalOfficeId || !scope.regionalOfficeIds.includes(store.regionalOfficeId)) {
      return forbidden("Forbidden: store is outside your assigned regional office.")
    }
    return null
  }
  if (scope.regionId) {
    if (!store.regionalOffice || store.regionalOffice.regionId !== scope.regionId) {
      return forbidden("Forbidden: store is outside your assigned region.")
    }
  }
  return null
}

/**
 * Verify a Guard's regionalOffice/region matches the user's scope. Used to
 * gate guard assignments / lookups on guard-scoped flows.
 */
export async function ensureGuardInScope(
  guardId: string | null | undefined,
  scope: ManagerScope | null,
): Promise<Response | null> {
  const id = guardId?.trim()
  if (!id || !scope) return null
  const guard = await prisma.guard.findUnique({
    where: { id },
    select: { regionalOfficeId: true, regionId: true },
  })
  if (!guard) return notFound("Guard not found.")
  if (scope.regionalOfficeIds.length > 0) {
    if (!guard.regionalOfficeId || !scope.regionalOfficeIds.includes(guard.regionalOfficeId)) {
      return forbidden("Forbidden: guard is outside your assigned regional office.")
    }
    return null
  }
  if (scope.regionId) {
    if (guard.regionId !== scope.regionId) {
      return forbidden("Forbidden: guard is outside your assigned region.")
    }
  }
  return null
}

/**
 * Verify a Client is within the user's scope. Branch-aware: branchful clients
 * are region-less and scope via their branches' offices, branchless clients via
 * their own region — both handled by the shared `clientInScope` SoT
 * (`src/lib/clients/access.ts`). Unrestricted/SuperAdmin (null scope) passes.
 */
export async function ensureClientInScope(
  clientId: string | null | undefined,
  scope: ManagerScope | null,
): Promise<Response | null> {
  const id = clientId?.trim()
  if (!id || !scope) return null
  const exists = await prisma.client.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return notFound("Client not found.")
  if (!(await clientInScope(id, scope))) {
    return forbidden("Forbidden: client is outside your assigned region.")
  }
  return null
}

/**
 * Verify a User's regionalOffice/region matches the user's scope (employee
 * assignments).
 */
export async function ensureUserInScope(
  userId: string | null | undefined,
  scope: ManagerScope | null,
): Promise<Response | null> {
  const id = userId?.trim()
  if (!id || !scope) return null
  const user = await prisma.user.findUnique({
    where: { id },
    select: { regionalOfficeId: true, regionId: true },
  })
  if (!user) return notFound("Employee not found.")
  if (scope.regionalOfficeIds.length > 0) {
    if (!user.regionalOfficeId || !scope.regionalOfficeIds.includes(user.regionalOfficeId)) {
      return forbidden("Forbidden: employee is outside your assigned regional office.")
    }
    return null
  }
  if (scope.regionId) {
    if (user.regionId !== scope.regionId) {
      return forbidden("Forbidden: employee is outside your assigned region.")
    }
  }
  return null
}

/**
 * Enforce that a source store and an assignment target share the same regional
 * office. A null on either side fails — inventory cannot move out of an
 * unscoped store, and cannot land on an unscoped target. Applies to ALL
 * operators (incl. SuperAdmin) so the same-office invariant cannot be broken
 * via legacy data with missing offices.
 */
export function rejectCrossOffice(
  storeOfficeId: string | null | undefined,
  targetOfficeId: string | null | undefined,
  targetLabel: string,
  targetKind: "guard" | "client" | "employee",
): string | null {
  if (!storeOfficeId || !targetOfficeId || storeOfficeId !== targetOfficeId) {
    return `Cross-region assignment not allowed: store and ${targetKind} "${targetLabel}" must belong to the same regional office.`
  }
  return null
}

export function requireV2WriteEnabled(): Response | null {
  const flags = getInventoryV2Flags()
  if (!flags.writeEnabled) {
    return forbidden("Inventory v2 writes are disabled by flag: inventory.v2.writeEnabled")
  }
  return null
}

export async function emitInventoryV2Audit(args: {
  userId?: string | null
  event: string
  description: string
  request?: NextRequest
}) {
  const ipAddress = args.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null

  try {
    await prisma.auditLog.create({
      data: {
        userId: args.userId ?? null,
        event: args.event,
        module: "INVENTORY_V2",
        description: args.description,
        ipAddress,
      },
    })
  } catch (error) {
    // If actor user no longer exists (e.g. DB was truncated), do not block the business write.
    // Retry audit write without user linkage.
    if (getPrismaCode(error) === "P2003") {
      await prisma.auditLog.create({
        data: {
          userId: null,
          event: args.event,
          module: "INVENTORY_V2",
          description: `${args.description} (user reference missing)`,
          ipAddress,
        },
      })
      return
    }
    throw error
  }
}

export function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export function parseNonNegativeInt(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return null
  return parsed
}

export function parseNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function asText(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

export function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const n = value.trim().toLowerCase()
    if (["1", "true", "yes", "on"].includes(n)) return true
    if (["0", "false", "no", "off"].includes(n)) return false
  }
  return fallback
}

export function envelopeSuccess<T>(data: T): ApiEnvelope<T> {
  return { success: true, data }
}

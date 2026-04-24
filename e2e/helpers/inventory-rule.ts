import { expect, type APIRequestContext, type Page } from "@playwright/test"

/**
 * Helpers for probing the GuardDeploymentInventoryRule from E2E tests.
 *
 * Endpoints used:
 *   - GET  /api/guard-deployment-inventory-rule      → read current rule
 *   - PUT  /api/guard-deployment-inventory-rule      → update rule
 *   - GET  /api/store-inventory/v2/assignments       → list assignments
 *   - POST /api/store-inventory/v2/assignments       → create assignment
 *   - POST /api/store-inventory/v2/assignments/:id/return → close/return
 *   - GET  /api/store-inventory/v2/products          → product catalogue
 *   - GET  /api/store-inventory/v2/masters/stores    → store catalogue
 */

export type InventoryRuleState = {
  id?: string
  ruleKey?: string
  isActive: boolean
  minimumAssignedItems: number
  allowedCategoryIds: string[]
}

type EnvelopeOrArray<T> = T[] | { data?: T[] } | { success?: boolean; data?: T[] }

type Assignment = {
  id: string
  status: string
  assignedToGuardId: string | null
  productId: string
  storeId: string
  product?: { id: string; categoryId?: string | null; category?: { id?: string | null } | null }
}

type Product = {
  id: string
  sku?: string
  name?: string
  categoryId?: string | null
  category?: { id?: string | null; name?: string | null } | null
}

type StoreMaster = {
  id: string
  code?: string
  name?: string
  regionalOfficeId?: string | null
}

type Guard = { id: string; parwestId: string; name: string; regionalOfficeId?: string | null }

function unwrapList<T>(body: EnvelopeOrArray<T>): T[] {
  if (Array.isArray(body)) return body
  const maybeData = (body as { data?: T[] }).data
  return Array.isArray(maybeData) ? maybeData : []
}

/** Read the current deployment inventory rule. */
export async function getInventoryRule(req: APIRequestContext): Promise<InventoryRuleState> {
  const res = await req.get(`/api/guard-deployment-inventory-rule`)
  expect(res.ok(), `GET rule failed (${res.status()})`).toBe(true)
  const body = (await res.json()) as {
    id?: string
    ruleKey?: string
    isActive: boolean
    minimumAssignedItems: number
    allowedCategoryIds?: unknown
  }
  const allowed = Array.isArray(body.allowedCategoryIds)
    ? body.allowedCategoryIds.map((x) => String(x ?? "").trim()).filter(Boolean)
    : []
  return {
    id: body.id,
    ruleKey: body.ruleKey,
    isActive: Boolean(body.isActive),
    minimumAssignedItems: Number(body.minimumAssignedItems ?? 0),
    allowedCategoryIds: allowed,
  }
}

/** Write the deployment inventory rule. Uses PUT (the only mutating verb the route exposes). */
export async function setInventoryRule(
  req: APIRequestContext,
  next: Pick<InventoryRuleState, "isActive" | "minimumAssignedItems" | "allowedCategoryIds">
): Promise<InventoryRuleState> {
  const res = await req.put(`/api/guard-deployment-inventory-rule`, {
    data: {
      isActive: next.isActive,
      minimumAssignedItems: next.minimumAssignedItems,
      allowedCategoryIds: next.allowedCategoryIds,
    },
  })
  expect(
    res.ok(),
    `PUT rule failed (${res.status()}): ${await res.text()}`
  ).toBe(true)
  return getInventoryRule(req)
}

/** Ensure the rule is active with the supplied minimum + allowed categories. */
export async function ensureRuleActive(
  req: APIRequestContext,
  opts: { minimumAssignedItems: number; allowedCategoryIds: string[] }
): Promise<InventoryRuleState> {
  const current = await getInventoryRule(req)
  const needsPatch =
    !current.isActive ||
    current.minimumAssignedItems !== opts.minimumAssignedItems ||
    (opts.allowedCategoryIds.length > 0 &&
      current.allowedCategoryIds.join(",") !== opts.allowedCategoryIds.join(","))
  if (!needsPatch) return current
  return setInventoryRule(req, {
    isActive: true,
    minimumAssignedItems: opts.minimumAssignedItems,
    allowedCategoryIds:
      opts.allowedCategoryIds.length > 0 ? opts.allowedCategoryIds : current.allowedCategoryIds,
  })
}

/** Fetch ASSIGNED (open) store-inventory assignments for the given guard. */
export async function getActiveAssignmentsForGuard(
  req: APIRequestContext,
  guardId: string
): Promise<Assignment[]> {
  const res = await req.get(
    `/api/store-inventory/v2/assignments?assignedToGuardId=${encodeURIComponent(
      guardId
    )}&status=ASSIGNED`
  )
  if (!res.ok()) return []
  const body = (await res.json()) as EnvelopeOrArray<Assignment>
  return unwrapList(body).filter(
    (a) => a.status === "ASSIGNED" && a.assignedToGuardId === guardId
  )
}

/** Return any ASSIGNED inventory currently held by the guard, via the /return endpoint. */
export async function clearGuardAssignments(
  req: APIRequestContext,
  guardId: string
): Promise<number> {
  const active = await getActiveAssignmentsForGuard(req, guardId)
  let closed = 0
  for (const row of active) {
    const res = await req.post(
      `/api/store-inventory/v2/assignments/${row.id}/return`,
      { data: { status: "RETURNED", notes: "E2E rule probe cleanup" } }
    )
    if (res.ok()) closed++
  }
  return closed
}

export async function resolveGuard(
  page: Page,
  parwestId: string
): Promise<Guard> {
  // Delegate to lifecycle-fixtures so regionalOfficeId is resolved consistently
  // (the search endpoint strips that field; shared helper enriches via offices).
  const { findGuardByParwestId } = await import("./lifecycle-fixtures")
  const guard = (await findGuardByParwestId(page.request, parwestId)) as Guard | null
  expect(guard, `Guard ${parwestId} not found — did you run the lifecycle seed?`).toBeTruthy()
  return guard!
}

/** List master stores via the v2 masters endpoint. */
export async function listStores(req: APIRequestContext): Promise<StoreMaster[]> {
  const res = await req.get(`/api/store-inventory/v2/masters/stores`)
  if (!res.ok()) return []
  const body = (await res.json()) as EnvelopeOrArray<StoreMaster>
  return unwrapList(body)
}

/** List products via the v2 products endpoint (includes category). */
export async function listProducts(req: APIRequestContext): Promise<Product[]> {
  const res = await req.get(`/api/store-inventory/v2/products`)
  if (!res.ok()) return []
  const body = (await res.json()) as EnvelopeOrArray<Product>
  return unwrapList(body)
}

/**
 * Pick a store whose regionalOfficeId matches (or is absent for both) the guard,
 * so the cross-region guard in the assignments POST does not reject us.
 */
function pickStoreForGuard(stores: StoreMaster[], guard: Guard): StoreMaster | undefined {
  if (!guard.regionalOfficeId) return stores[0]
  const sameRegion = stores.find((s) => s.regionalOfficeId === guard.regionalOfficeId)
  if (sameRegion) return sameRegion
  return stores.find((s) => !s.regionalOfficeId)
}

/**
 * Create a store-inventory assignment (via POST /assignments) for the guard
 * using the first product whose categoryId is in `allowedCategoryIds`.
 *
 * Returns the created assignment id, or null when the API prerequisites
 * (products, stores, stock balance) aren't met.
 */
export async function assignAllowedItemToGuard(
  page: Page,
  guard: Guard,
  allowedCategoryIds: string[]
): Promise<string | null> {
  const [products, stores] = await Promise.all([
    listProducts(page.request),
    listStores(page.request),
  ])

  const matchesAllowed = (p: Product) => {
    if (allowedCategoryIds.length === 0) return true
    const cid = p.categoryId ?? p.category?.id ?? null
    return cid != null && allowedCategoryIds.includes(String(cid))
  }

  const product = products.find(matchesAllowed)
  if (!product) return null

  const store = pickStoreForGuard(stores, guard)
  if (!store) return null

  const res = await page.request.post(`/api/store-inventory/v2/assignments`, {
    data: {
      storeId: store.id,
      assignedToType: "GUARD",
      assignedToGuardId: guard.id,
      productId: product.id,
      quantity: 1,
      notes: "E2E inventory-rule probe",
    },
  })
  if (!res.ok()) return null
  const body = (await res.json()) as EnvelopeOrArray<{ id: string }>
  const rows = unwrapList(body)
  return rows[0]?.id ?? null
}

/**
 * Ensure the guard has ≥1 ASSIGNED item in one of the allowed categories.
 * If not, attempts to create one via the assignments POST. Returns true when
 * the guard satisfies the rule afterwards.
 */
export async function ensureAllowedAssignmentForGuard(
  page: Page,
  guard: Guard,
  allowedCategoryIds: string[]
): Promise<boolean> {
  const existing = await getActiveAssignmentsForGuard(page.request, guard.id)
  const hasAllowed = existing.some((a) => {
    if (allowedCategoryIds.length === 0) return true
    const cid = a.product?.categoryId ?? a.product?.category?.id ?? null
    return cid != null && allowedCategoryIds.includes(String(cid))
  })
  if (hasAllowed) return true

  const created = await assignAllowedItemToGuard(page, guard, allowedCategoryIds)
  if (created) return true

  // Fall back: any ASSIGNED item counts when allowedCategoryIds is empty on
  // the active rule (the route only filters by category when the list is
  // non-empty — see src/app/api/deployments/route.ts).
  return existing.length > 0 && allowedCategoryIds.length === 0
}

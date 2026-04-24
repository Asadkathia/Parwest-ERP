import { expect, type APIRequestContext, type Page } from "@playwright/test"

/**
 * Fixtures bound to the `npm run seed:lifecycle:e2e` dataset. Running the seed
 * is a prerequisite for any spec that imports from this file.
 *
 *   LIFECYCLE_E2E_SEED_EXECUTE=true node scripts/seed-guard-lifecycle-e2e.mjs
 *
 * Known landmarks:
 *   - Regional office  "Lahore Head Office" (seriesCode LHR)
 *   - Client           "Lifecycle National Bank"
 *   - Branch           "Lifecycle Branch Lahore Main"
 *   - Guards           LC-G-0001 … LC-G-0008 (see seed for statuses)
 *   - Supervisor user  supervisor.lifecycle@parwest.test
 */

export const LIFECYCLE = {
  office: { name: "Lahore Head Office", seriesCode: "LHR" },
  client: { name: "Lifecycle National Bank" },
  branch: { name: "Lifecycle Branch Lahore Main" },
  supervisorEmail: "supervisor.lifecycle@parwest.test",
  guards: {
    pending: { parwestId: "LC-G-0001", name: "Lifecycle Guard Enrolled" },
    verified: { parwestId: "LC-G-0002", name: "Lifecycle Guard Verified" },
    assigned: { parwestId: "LC-G-0003", name: "Lifecycle Guard Assigned" },
    activeDeployed: { parwestId: "LC-G-0004", name: "Lifecycle Guard Deployed Active" },
    inactive: { parwestId: "LC-G-0008", name: "Lifecycle Guard Inactive" },
  },
} as const

type Guard = { id: string; parwestId: string; name: string; regionalOfficeId?: string }
type User = { id: string; name: string; email: string }
type Client = { id: string; name: string }
type Contract = { id: string; isActive: boolean }

export async function findGuardByParwestId(
  req: APIRequestContext,
  parwestId: string
): Promise<Guard | null> {
  // Step 1: filter by parwestId via search. Returns a trimmed projection
  // (no regionalOfficeId), but includes officeName which we can map below.
  const searchRes = await req.get(
    `/api/guards/search?q=${encodeURIComponent(parwestId)}&take=5`
  )
  if (!searchRes.ok()) return null
  const searchBody = (await searchRes.json()) as
    | (Guard & { officeName?: string })[]
    | { data?: (Guard & { officeName?: string })[] }
  const list = Array.isArray(searchBody) ? searchBody : searchBody.data ?? []
  const base = list.find((g) => g.parwestId === parwestId)
  if (!base) return null

  // Step 2: resolve regionalOfficeId from officeName — search endpoint doesn't
  // project it, but the deployment POST requires it.
  if (!base.regionalOfficeId && base.officeName) {
    const officesRes = await req.get(`/api/regional-offices`)
    if (officesRes.ok()) {
      const offices = (await officesRes.json()) as
        | { id: string; name: string }[]
        | { data?: { id: string; name: string }[] }
      const officesList = Array.isArray(offices) ? offices : offices.data ?? []
      const office = officesList.find((o) => o.name === base.officeName)
      if (office) base.regionalOfficeId = office.id
    }
  }
  return base
}

async function findSupervisorUser(
  req: APIRequestContext,
  email: string
): Promise<User | null> {
  const res = await req.get(`/api/users?status=ACTIVE`)
  if (!res.ok()) return null
  const body = (await res.json()) as User[] | { data?: User[] }
  const users: User[] = Array.isArray(body) ? body : body.data ?? []
  return users.find((u) => u.email === email) ?? null
}

async function findClientByName(
  req: APIRequestContext,
  name: string
): Promise<Client | null> {
  const res = await req.get(`/api/clients?take=200`)
  if (!res.ok()) return null
  const body = (await res.json()) as Client[] | { data?: Client[] }
  const list: Client[] = Array.isArray(body) ? body : body.data ?? []
  return list.find((c) => c.name === name) ?? null
}

/**
 * End any ACTIVE deployments for the given guard. Used before a happy-path
 * test to ensure the guard is "deployment-clean", since prior runs may have
 * left an ACTIVE deployment that blocks the singleActivePerGuard rule.
 *
 * GET /api/deployments does not accept guardId or status filters — it returns
 * up to 200 rows unfiltered. We filter client-side to avoid ending unrelated
 * deployments.
 */
export async function endActiveDeploymentsForGuard(
  page: Page,
  guardParwestId: string
): Promise<number> {
  const guard = await findGuardByParwestId(page.request, guardParwestId)
  if (!guard) return 0
  const listRes = await page.request.get(`/api/deployments`)
  if (!listRes.ok()) return 0
  const body = (await listRes.json()) as
    | { id: string; guardId?: string; status?: string }[]
    | { data?: { id: string; guardId?: string; status?: string }[] }
  const all = Array.isArray(body) ? body : body.data ?? []
  const mine = all.filter(
    (d) => d.guardId === guard.id && d.status === "ACTIVE"
  )
  let ended = 0
  for (const d of mine) {
    const res = await page.request.post(`/api/deployments/${d.id}/end`, {
      data: {
        endDate: new Date().toISOString().slice(0, 10),
        endReason: "E2E cleanup",
      },
    })
    if (res.ok()) ended++
  }
  return ended
}

/**
 * Ensure the given guard has exactly one ACTIVE deployment (creating one via
 * direct POST if needed) so the singleActivePerGuard rule can be probed.
 * Returns the id of the active deployment.
 */
export async function ensureOneActiveDeployment(
  page: Page,
  guardParwestId: string,
  shift: "DAY" | "NIGHT" | "BOTH" = "DAY"
): Promise<string> {
  await ensureLifecycleContract(page)
  await ensureSupervisorAssigned(page, guardParwestId)
  const guard = await findGuardByParwestId(page.request, guardParwestId)
  expect(guard).toBeTruthy()

  const listRes = await page.request.get(`/api/deployments`)
  const body = (await listRes.json()) as
    | { id: string; guardId?: string; status?: string; shiftType?: string }[]
    | { data?: { id: string; guardId?: string; status?: string; shiftType?: string }[] }
  const all = Array.isArray(body) ? body : body.data ?? []
  const existing = all.find(
    (d) => d.guardId === guard!.id && d.status === "ACTIVE" && d.shiftType === shift
  )
  if (existing) return existing.id

  // End any conflicting ACTIVE deployments (wrong shift, BOTH, etc.)
  await endActiveDeploymentsForGuard(page, guardParwestId)

  // Create one via POST /api/deployments.
  const client = await findClientByName(page.request, LIFECYCLE.client.name)
  const branchesRes = await page.request.get(`/api/clients/${client!.id}/branches`)
  const branches = (await branchesRes.json()) as { id: string; name: string }[]
  const branch = Array.isArray(branches)
    ? branches.find((b) => b.name === LIFECYCLE.branch.name)
    : undefined
  expect(branch, `Branch ${LIFECYCLE.branch.name} not found`).toBeTruthy()

  const res = await page.request.post(`/api/deployments`, {
    data: {
      guardId: guard!.id,
      clientId: client!.id,
      branchId: branch!.id,
      regionalOfficeId: guard!.regionalOfficeId,
      designation: "Guard",
      deploymentDate: new Date().toISOString().slice(0, 10),
      shiftType: shift,
      deploymentType: "REGULAR",
      deploymentNature: "PERMANENT",
      salary: 1500,
      status: "ACTIVE",
    },
  })
  expect(
    res.ok(),
    `POST /api/deployments for ${guardParwestId} failed (${res.status()}): ${await res.text()}`
  ).toBe(true)
  const created = (await res.json()) as { id: string }
  return created.id
}

/**
 * Ensure an active ClientContract exists for the lifecycle client so that
 * deployment's `requireBranchContract` workflow rule passes.
 */
export async function ensureLifecycleContract(page: Page): Promise<Contract> {
  const client = await findClientByName(page.request, LIFECYCLE.client.name)
  expect(client, `Client ${LIFECYCLE.client.name} not found — did you run the lifecycle seed?`).toBeTruthy()

  const existingRes = await page.request.get(`/api/clients/${client!.id}/contracts`)
  if (existingRes.ok()) {
    const contracts = (await existingRes.json()) as Contract[]
    const active = contracts.find((c) => c.isActive)
    if (active) return active
  }

  const createRes = await page.request.post(`/api/clients/${client!.id}/contracts`, {
    data: { name: "E2E Happy Path Contract", type: "GENERAL" },
  })
  expect(createRes.ok(), `POST /contracts failed: ${createRes.status()}`).toBe(true)
  return (await createRes.json()) as Contract
}

/**
 * Ensures the given guard has an ACTIVE supervisor assignment. Safe to call
 * repeatedly — PATCH /api/guards/[id]/supervisor ends any existing active
 * assignment before creating a new one.
 */
export async function ensureSupervisorAssigned(
  page: Page,
  guardParwestId: string,
  supervisorEmail: string = LIFECYCLE.supervisorEmail
): Promise<{ guard: Guard; supervisor: User }> {
  const guard = await findGuardByParwestId(page.request, guardParwestId)
  expect(guard, `Guard ${guardParwestId} not found — did you run the lifecycle seed?`).toBeTruthy()
  const supervisor = await findSupervisorUser(page.request, supervisorEmail)
  expect(
    supervisor,
    `Supervisor user ${supervisorEmail} not found — did you run the lifecycle seed?`
  ).toBeTruthy()

  const res = await page.request.patch(`/api/guards/${guard!.id}/supervisor`, {
    data: { supervisorId: supervisor!.id, notes: "E2E setup" },
  })
  expect(res.ok(), `PATCH supervisor failed: ${res.status()}`).toBe(true)
  return { guard: guard!, supervisor: supervisor! }
}

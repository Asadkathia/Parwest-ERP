import { test, expect, type Page } from "@playwright/test"
import {
  LIFECYCLE,
  endActiveDeploymentsForGuard,
  ensureLifecycleContract,
  ensureSupervisorAssigned,
} from "./helpers/lifecycle-fixtures"
import {
  ensureAllowedAssignmentForGuard,
  ensureRuleActive,
  clearGuardAssignments,
  getInventoryRule,
  resolveGuard,
  setInventoryRule,
  type InventoryRuleState,
} from "./helpers/inventory-rule"

/**
 * Probes for GuardDeploymentInventoryRule enforcement at the API layer.
 *
 *   Rule (seeded): isActive=true, minimumAssignedItems=1,
 *                  allowedCategoryIds=[Uniform categoryId]
 *
 *   Negative  — LC-G-0002 has NO assigned inventory → POST /api/deployments
 *               should 409 with a message referencing assigned inventory /
 *               minimum items.
 *   Positive — LC-G-0003 has an ASSIGNED uniform → POST /api/deployments
 *               should succeed (2xx) and create a row.
 *
 * These are API-level checks (page.request) — no UI interaction.
 *
 * Prereq: the lifecycle seed has been run.
 */

type ClientRef = { id: string; name: string }
type BranchRef = { id: string; name: string }

async function resolveClientAndBranch(
  page: Page
): Promise<{ client: ClientRef; branch: BranchRef }> {
  const clientsRes = await page.request.get(`/api/clients?take=200`)
  expect(clientsRes.ok(), `GET /api/clients failed (${clientsRes.status()})`).toBe(true)
  const clientsBody = (await clientsRes.json()) as ClientRef[] | { data?: ClientRef[] }
  const clientsList = Array.isArray(clientsBody) ? clientsBody : clientsBody.data ?? []
  const client = clientsList.find((c) => c.name === LIFECYCLE.client.name)
  expect(client, `Client ${LIFECYCLE.client.name} not found — run lifecycle seed`).toBeTruthy()

  const branchesRes = await page.request.get(`/api/clients/${client!.id}/branches`)
  expect(branchesRes.ok()).toBe(true)
  const branchesBody = (await branchesRes.json()) as BranchRef[] | { data?: BranchRef[] }
  const branches = Array.isArray(branchesBody) ? branchesBody : branchesBody.data ?? []
  const branch = branches.find((b) => b.name === LIFECYCLE.branch.name)
  expect(branch, `Branch ${LIFECYCLE.branch.name} not found — run lifecycle seed`).toBeTruthy()

  return { client: client!, branch: branch! }
}

function buildDeploymentBody(input: {
  guardId: string
  clientId: string
  branchId: string
  regionalOfficeId?: string | null
}) {
  return {
    guardId: input.guardId,
    clientId: input.clientId,
    branchId: input.branchId,
    regionalOfficeId: input.regionalOfficeId ?? undefined,
    designation: "Guard",
    deploymentDate: new Date().toISOString().slice(0, 10),
    shiftType: "DAY" as const,
    deploymentType: "REGULAR",
    deploymentNature: "PERMANENT",
    salary: 1500,
    status: "ACTIVE" as const,
  }
}

test.describe("Deployment — GuardDeploymentInventoryRule enforcement", () => {
  let originalRule: InventoryRuleState | null = null

  test.beforeAll(async ({ request }) => {
    originalRule = await getInventoryRule(request)
  })

  test.afterAll(async ({ request }) => {
    if (!originalRule) return
    // Restore the seeded rule state so sibling specs see the same preconditions.
    await setInventoryRule(request, {
      isActive: originalRule.isActive,
      minimumAssignedItems: originalRule.minimumAssignedItems,
      allowedCategoryIds: originalRule.allowedCategoryIds,
    })
  })

  test("rejects a guard with zero assigned inventory (409, inventory message)", async ({
    page,
  }) => {
    const verifiedParwestId = LIFECYCLE.guards.verified.parwestId // LC-G-0002

    // Clean slate: end any active deployments, ensure supervisor + contract.
    await endActiveDeploymentsForGuard(page, verifiedParwestId)
    await ensureSupervisorAssigned(page, verifiedParwestId)
    await ensureLifecycleContract(page)

    // Confirm (and, if necessary, restore) the rule's active state.
    const seededAllowed = originalRule?.allowedCategoryIds ?? []
    const rule = await ensureRuleActive(page.request, {
      minimumAssignedItems: 1,
      allowedCategoryIds: seededAllowed,
    })
    expect(rule.isActive).toBe(true)
    expect(rule.minimumAssignedItems).toBeGreaterThanOrEqual(1)

    // Ensure this guard has zero open assignments — return anything open.
    const guard = await resolveGuard(page, verifiedParwestId)
    await clearGuardAssignments(page.request, guard.id)

    const { client, branch } = await resolveClientAndBranch(page)

    const res = await page.request.post(`/api/deployments`, {
      data: buildDeploymentBody({
        guardId: guard.id,
        clientId: client.id,
        branchId: branch.id,
        regionalOfficeId: guard.regionalOfficeId ?? undefined,
      }),
    })

    const body = (await res.json().catch(() => ({}))) as { message?: string }
    expect(
      res.status(),
      `Expected 409, got ${res.status()}: ${body.message ?? JSON.stringify(body)}`
    ).toBe(409)
    expect(body.message ?? "").toMatch(/inventory|assigned items|minimum/i)
  })

  test("accepts a guard that holds an allowed-category assignment (2xx)", async ({
    page,
  }) => {
    const assignedParwestId = LIFECYCLE.guards.assigned.parwestId // LC-G-0003

    await endActiveDeploymentsForGuard(page, assignedParwestId)
    await ensureSupervisorAssigned(page, assignedParwestId)
    await ensureLifecycleContract(page)

    const seededAllowed = originalRule?.allowedCategoryIds ?? []
    const rule = await ensureRuleActive(page.request, {
      minimumAssignedItems: 1,
      allowedCategoryIds: seededAllowed,
    })

    const guard = await resolveGuard(page, assignedParwestId)
    const ok = await ensureAllowedAssignmentForGuard(
      page,
      guard,
      rule.allowedCategoryIds
    )
    expect(
      ok,
      `Guard ${assignedParwestId} must have ≥1 ASSIGNED item in an allowed category`
    ).toBe(true)

    const { client, branch } = await resolveClientAndBranch(page)

    const res = await page.request.post(`/api/deployments`, {
      data: buildDeploymentBody({
        guardId: guard.id,
        clientId: client.id,
        branchId: branch.id,
        regionalOfficeId: guard.regionalOfficeId ?? undefined,
      }),
    })

    const status = res.status()
    const bodyText = await res.text()
    expect(
      status >= 200 && status < 300,
      `Expected 2xx, got ${status}: ${bodyText}`
    ).toBe(true)

    const parsed = JSON.parse(bodyText) as { id?: string; data?: { id?: string } }
    const deploymentId = parsed.id ?? parsed.data?.id
    expect(deploymentId, "Created deployment row should have an id").toBeTruthy()

    // Tidy up so downstream specs start from a known clean state for LC-G-0003.
    await endActiveDeploymentsForGuard(page, assignedParwestId)
  })
})

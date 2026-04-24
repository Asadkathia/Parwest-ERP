import { test, expect } from "@playwright/test"
import {
  LIFECYCLE,
  endActiveDeploymentsForGuard,
  ensureLifecycleContract,
  ensureOneActiveDeployment,
  ensureSupervisorAssigned,
} from "./helpers/lifecycle-fixtures"
import { fillDeployForm, clickDeploySave } from "./helpers/deploy-form"

/**
 * Positive counterpart to the "second DAY is rejected" test in
 * `deployments-rules.spec.ts`. Proves the DAY+NIGHT shift-split exception to
 * the singleActivePerGuard rule: a guard with one ACTIVE DAY deployment may
 * take a second ACTIVE NIGHT deployment (double duty), but not two of the
 * same shift.
 *
 * The API logic lives in `src/app/api/deployments/route.ts` around lines
 * 245–294 ("Shift-conflict check"). This spec covers the allow-branch.
 *
 * Prereq: `LIFECYCLE_E2E_SEED_EXECUTE=true node scripts/seed-guard-lifecycle-e2e.mjs`.
 */

test.describe("Deployment — DAY+NIGHT shift split (singleActivePerGuard exception)", () => {
  test("guard with ACTIVE DAY deployment CAN take a second ACTIVE NIGHT deployment", async ({
    page,
  }) => {
    test.slow() // heavy setup: 4 API calls + full UI drive + submit

    const parwestId = LIFECYCLE.guards.activeDeployed.parwestId

    // Self-healing setup: guarantee exactly one ACTIVE DAY deployment for
    // LC-G-0004. End any prior active deployments first (including stale
    // NIGHT rows left by a previous run of this spec), then ensure a single
    // DAY one exists.
    await ensureLifecycleContract(page)
    await ensureSupervisorAssigned(page, parwestId)
    await endActiveDeploymentsForGuard(page, parwestId)
    const dayDeploymentId = await ensureOneActiveDeployment(page, parwestId, "DAY")
    expect(dayDeploymentId).toBeTruthy()

    const createResponse = page.waitForResponse(
      (r) => r.url().endsWith("/api/deployments") && r.request().method() === "POST",
      { timeout: 20_000 }
    )

    await fillDeployForm(page, {
      guardParwestId: parwestId,
      shift: "NIGHT",
    })
    await clickDeploySave(page)

    const res = await createResponse
    const body = (await res.json().catch(() => ({}))) as {
      id?: string
      shiftType?: string
      status?: string
      message?: string
    }

    expect(
      res.status(),
      `Expected success, got ${res.status()}: ${body.message ?? JSON.stringify(body)}`
    ).toBeLessThan(400)
    expect(body.id).toBeTruthy()
    expect(body.shiftType).toBe("NIGHT")
    expect(body.status).toBe("ACTIVE")
    expect(body.id).not.toBe(dayDeploymentId)

    await expect(page).toHaveURL(new RegExp(`/deployments/${body.id}$`), {
      timeout: 15_000,
    })
  })
})

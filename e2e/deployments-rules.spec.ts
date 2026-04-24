import { test, expect } from "@playwright/test"
import {
  LIFECYCLE,
  ensureLifecycleContract,
  ensureOneActiveDeployment,
} from "./helpers/lifecycle-fixtures"
import { fillDeployForm, clickDeploySave } from "./helpers/deploy-form"

/**
 * Deployment workflow-rule probes. Each test picks a different lifecycle
 * guard to exercise a specific rule path.
 *
 * Prereq: lifecycle seed has been run (and lifecycleStatus synced with status).
 */

test.describe("Deployment — workflow rule enforcement", () => {
  test("PENDING guard is rejected with 'lifecycle status' message (requireActiveGuardStatus)", async ({
    page,
  }) => {
    await ensureLifecycleContract(page)

    const createResponse = page.waitForResponse(
      (r) => r.url().endsWith("/api/deployments") && r.request().method() === "POST",
      { timeout: 20_000 }
    )
    const clientErrorBanner = page.locator(".bg-red-50").first()

    await fillDeployForm(page, { guardParwestId: LIFECYCLE.guards.pending.parwestId })
    await clickDeploySave(page)

    const first = await Promise.race([
      createResponse.then(async (r) => ({
        kind: "post" as const,
        status: r.status(),
        body: (await r.json().catch(() => ({}))) as { message?: string },
      })),
      clientErrorBanner
        .waitFor({ state: "visible", timeout: 20_000 })
        .then(async () => ({
          kind: "client" as const,
          text: (await clientErrorBanner.textContent())?.trim() ?? "",
        })),
    ])

    // Accept either a 409 server rejection OR a client-side eligibility banner
    // (the deploy form runs a client eligibility check that may short-circuit).
    if (first.kind === "post") {
      expect(first.status).toBe(409)
      expect(first.body.message ?? "").toMatch(/lifecycle status.*PENDING/i)
    } else {
      expect(first.text).toMatch(/not eligible|lifecycle status|pending/i)
    }
  })

  test("second ACTIVE DAY deployment for a guard is rejected (singleActivePerGuard)", async ({
    page,
  }) => {
    await ensureLifecycleContract(page)
    // Ensure LC-G-0004 has exactly one ACTIVE DAY deployment to probe
    // singleActivePerGuard. This is self-sufficient: prior test runs may have
    // ended the seeded deployment, so we recreate if missing.
    await ensureOneActiveDeployment(
      page,
      LIFECYCLE.guards.activeDeployed.parwestId,
      "DAY"
    )

    const createResponse = page.waitForResponse(
      (r) => r.url().endsWith("/api/deployments") && r.request().method() === "POST",
      { timeout: 20_000 }
    )

    await fillDeployForm(page, {
      guardParwestId: LIFECYCLE.guards.activeDeployed.parwestId,
      shift: "DAY",
    })
    await clickDeploySave(page)

    const res = await createResponse
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    expect(
      res.status(),
      `Expected 409, got ${res.status()}: ${body.message ?? JSON.stringify(body)}`
    ).toBe(409)
    expect(body.message ?? "").toMatch(/already (deployed|active)|active DAY|another active/i)
  })
})

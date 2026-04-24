import { test, expect } from "@playwright/test"
import {
  LIFECYCLE,
  endActiveDeploymentsForGuard,
  ensureLifecycleContract,
  ensureSupervisorAssigned,
} from "./helpers/lifecycle-fixtures"
import { pickDeployCombobox } from "./helpers/deploy-combobox"

/**
 * Full happy-path deployment test.
 *
 * Prerequisite: `LIFECYCLE_E2E_SEED_EXECUTE=true node scripts/seed-guard-lifecycle-e2e.mjs`
 * must have been run. The seed creates known ACTIVE guards + a client with a
 * branch in Lahore. LC-G-0003 is the cleanest candidate — ACTIVE, uniform
 * assigned (satisfies GuardDeploymentInventoryRule), and no existing
 * deployment. The seed does NOT create a supervisor assignment; we add one
 * in beforeAll via the PATCH API.
 */

test.describe("Deployment — happy path (lifecycle fixture)", () => {
  test("creates an ACTIVE deployment for LC-G-0003 and redirects to /deployments/[id]", async ({
    page,
  }) => {
    // Clean slate: end any ACTIVE deployments left by prior runs so
    // singleActivePerGuard doesn't trip.
    await endActiveDeploymentsForGuard(page, LIFECYCLE.guards.assigned.parwestId)
    // Assign supervisor; deployment API requires an ACTIVE GuardSupervisorAssignment.
    await ensureSupervisorAssigned(page, LIFECYCLE.guards.assigned.parwestId)
    // And an active ClientContract for the branch (requireBranchContract rule).
    await ensureLifecycleContract(page)

    await page.goto("/guards/deploy")
    await expect(page.getByRole("heading", { name: /deploy guards/i }).first()).toBeVisible()

    // Disambiguate by series code — the base seed also has a "Lahore Head Office" (seriesCode "L").
    await pickDeployCombobox(
      page,
      /^Regional Office\s*\*?$/,
      new RegExp(`${LIFECYCLE.office.name} \\(${LIFECYCLE.office.seriesCode}\\)`)
    )
    // Client options render as `"${name} (${type})"` — match the name fragment.
    await pickDeployCombobox(
      page,
      /^Select Client\s*\*?$/,
      new RegExp(LIFECYCLE.client.name)
    )
    // "Branch *" label + required=true → rendered text has two asterisks.
    await pickDeployCombobox(page, /^Branch\s*\*+$/, new RegExp(LIFECYCLE.branch.name))
    await pickDeployCombobox(page, /^Deploy As\s*\*+$/, /^Guard$/)

    // Filter guard list — the "Filter by Guard ID / Name" input narrows the
    // combobox options by parwestId or name.
    await page
      .locator('input[placeholder="e.g. PW-00123 or type a name..."]')
      .fill(LIFECYCLE.guards.assigned.parwestId)

    await pickDeployCombobox(
      page,
      /^Select Guard\s*\*?$/,
      LIFECYCLE.guards.assigned.parwestId
    )

    // Shift
    await pickDeployCombobox(page, /^Shift\s*\*?$/, /^day$/i)

    // Daily rate is required
    await page
      .locator("label", { hasText: /Daily Rate/i })
      .locator("..")
      .locator('input[type="number"]')
      .fill("1500")

    // Intercept the POST — the form router.push()es on success.
    const createResponse = page.waitForResponse(
      (r) => r.url().endsWith("/api/deployments") && r.request().method() === "POST",
      { timeout: 20_000 }
    )

    await page.getByRole("button", { name: /^Save$/ }).click()

    const res = await createResponse
    const body = (await res.json().catch(() => ({}))) as {
      id?: string
      message?: string
    }

    expect(res.ok(), `POST /api/deployments failed (${res.status()}): ${body?.message ?? JSON.stringify(body)}`).toBe(true)
    expect(body.id).toBeTruthy()

    await expect(page).toHaveURL(new RegExp(`/deployments/${body.id}$`), { timeout: 15_000 })
  })
})

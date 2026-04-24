import { test, expect } from "@playwright/test"
import {
  LIFECYCLE,
  endActiveDeploymentsForGuard,
  ensureLifecycleContract,
  ensureOneActiveDeployment,
  ensureSupervisorAssigned,
} from "./helpers/lifecycle-fixtures"

/**
 * Verifies the `deployments.blockInactiveUpdate` workflow rule: once a
 * deployment is ENDED (status=INACTIVE), mutation via PATCH /api/deployments/[id]
 * is rejected with 4xx.
 *
 * Uses LC-G-0003 (lifecycle guards.assigned) to avoid interfering with the
 * LC-G-0004 fixtures used by deployments-rules.spec.ts.
 *
 * Default of `deployments.blockInactiveUpdate` is `true` in the balanced
 * preset (src/lib/workflows/policy.ts). `deployments.lockAfterEnd` is also
 * `true` and is checked first in the PATCH handler — so the server message
 * can reference either an "ended"/"cannot be modified" or an "inactive"
 * deployment. Both rules should be enforced here.
 */

type DeploymentRow = {
  id: string
  guardId?: string
  status?: string
}

type DeploymentListBody = DeploymentRow[] | { data?: DeploymentRow[] }

test.describe("Deployment — blockInactiveUpdate rule", () => {
  const guardParwestId = LIFECYCLE.guards.assigned.parwestId

  test("PATCH on an ENDED deployment is rejected (lockAfterEnd / blockInactiveUpdate)", async ({
    page,
  }) => {
    test.slow() // heavy setup: 4 API calls before the actual check

    // Step 0: seed preconditions. Clean any leftover ACTIVE deployments for
    // LC-G-0003, attach supervisor, ensure an active contract, then create a
    // fresh ACTIVE DAY deployment.
    await endActiveDeploymentsForGuard(page, guardParwestId)
    await ensureSupervisorAssigned(page, guardParwestId)
    await ensureLifecycleContract(page)
    const deploymentId = await ensureOneActiveDeployment(page, guardParwestId, "DAY")

    // Step 1: end the deployment via POST /api/deployments/[id]/end.
    const today = new Date().toISOString().slice(0, 10)
    const endRes = await page.request.post(`/api/deployments/${deploymentId}/end`, {
      data: {
        endDate: today,
        endReason: "E2E lock test",
      },
    })
    expect(
      endRes.ok(),
      `POST /api/deployments/${deploymentId}/end failed (${endRes.status()}): ${await endRes.text()}`
    ).toBe(true)

    // Sanity check: deployment is now INACTIVE.
    const listRes = await page.request.get(`/api/deployments`)
    expect(listRes.ok()).toBe(true)
    const listBody = (await listRes.json()) as DeploymentListBody
    const rows: DeploymentRow[] = Array.isArray(listBody) ? listBody : listBody.data ?? []
    const row = rows.find((d) => d.id === deploymentId)
    expect(row?.status, "ended deployment should be INACTIVE").toBe("INACTIVE")

    // Step 2: attempt a benign PATCH — must be rejected 4xx.
    const patchRes = await page.request.patch(`/api/deployments/${deploymentId}`, {
      data: {
        salary: 2000,
        rate: 0,
        overtime: 0,
        extraHours: 0,
        postAllowance: 0,
      },
    })

    const bodyText = await patchRes.text()
    const status = patchRes.status()
    expect(
      status >= 400 && status < 500,
      `Expected 4xx rejection, got ${status}: ${bodyText}`
    ).toBe(true)

    // Parse either the `{ success, message, code }` envelope or a plain JSON
    // error body defensively.
    let message = ""
    try {
      const parsed = JSON.parse(bodyText) as { message?: string; error?: string }
      message = parsed.message ?? parsed.error ?? ""
    } catch {
      message = bodyText
    }

    // The PATCH handler checks `lockAfterEnd` ("Deployment is ended and
    // cannot be modified.") before `blockInactiveUpdate` ("Cannot update an
    // inactive deployment."). Both defaults are `true`; accept either.
    expect(
      message,
      `Unexpected rejection message: "${message}"`
    ).toMatch(/inactive|ended|cannot be modified|cannot update|already ended/i)
  })
})

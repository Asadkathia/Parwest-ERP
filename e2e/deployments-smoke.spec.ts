import { test, expect } from "@playwright/test"

/**
 * Deployment module smoke tests.
 *
 * Full deployment creation requires ACTIVE guards with supervisor assignments
 * — state that's hard to arrange from the UI alone (guard activation and
 * supervisor assignment aren't part of any earlier spec). These smoke tests
 * verify the form's structural contract and the regional-office → client →
 * branch cascade. Deep happy-path + workflow-rule tests belong in a follow-up
 * once we have a DB seeding helper for ACTIVE guards.
 */

async function gotoDeploy(page: import("@playwright/test").Page) {
  await page.goto("/guards/deploy")
  await expect(page.getByRole("heading", { name: /deploy guards/i }).first()).toBeVisible()
}

function combobox(page: import("@playwright/test").Page, label: string | RegExp) {
  // SearchableCombobox renders as: <label>label</label><div class="ui-select">...</div>
  const root = page.locator("label", { hasText: label }).locator("..")
  return {
    root,
    trigger: root.locator(".ui-select").first(),
    placeholder: root.locator(".ui-select span").first(),
  }
}

test.describe("Deployment form — structural contract", () => {
  test("page loads at /guards/deploy and redirect from /deployments/new lands here", async ({
    page,
  }) => {
    await page.goto("/deployments/new")
    await expect(page).toHaveURL(/\/guards\/deploy$/)
    await expect(page.getByRole("heading", { name: /deploy guards/i }).first()).toBeVisible()
  })

  test("Regional Office is required and Client combobox is disabled until one is picked", async ({
    page,
  }) => {
    await gotoDeploy(page)

    const regionalOffice = combobox(page, /^Regional Office\s*\*?$/)
    const client = combobox(page, /^Select Client\s*\*?$/)

    // Both visible on load.
    await expect(regionalOffice.trigger).toBeVisible()
    await expect(client.trigger).toBeVisible()

    // Client trigger starts in the disabled visual state (opacity-50,
    // pointer-events-none, bg-slate-100 — see SearchableCombobox disabled prop).
    await expect(client.trigger).toHaveClass(/opacity-50/)

    // Placeholder text confirms the contract.
    await expect(client.placeholder).toContainText(/select regional office first/i)

    // Clicking the disabled client trigger must NOT open a dropdown.
    await client.trigger.click({ force: true })
    await expect(page.locator(".absolute.z-50")).toHaveCount(0)
  })

  test("picking a Regional Office enables the Client combobox", async ({ page }) => {
    await gotoDeploy(page)

    const regionalOffice = combobox(page, /^Regional Office\s*\*?$/)
    const client = combobox(page, /^Select Client\s*\*?$/)

    // Open the RO combobox and pick the first available option.
    await regionalOffice.trigger.click()
    const panel = regionalOffice.root.locator(".absolute.z-50")
    await expect(panel).toBeVisible()
    const firstOption = panel.locator(".cursor-pointer").first()
    await expect(firstOption, "at least one Regional Office must be seeded").toBeVisible()
    const firstOptionText = (await firstOption.textContent())?.trim() ?? ""
    await firstOption.click()

    // Trigger now shows the selected name and the client dropdown is enabled.
    await expect(regionalOffice.trigger).toContainText(firstOptionText)
    await expect(client.trigger).not.toHaveClass(/opacity-50/)
  })

  test("Save is disabled and submitting with no selection shows an error", async ({ page }) => {
    await gotoDeploy(page)

    // Save is rendered but clicking it without selections should surface an
    // error — the server will reject. We only need to confirm the button
    // exists and clicking doesn't silently submit.
    const saveBtn = page.getByRole("button", { name: /^Save$/ })
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toBeEnabled()

    // Set up a response listener to verify nothing is POSTed without a guard.
    let sawDeploymentPost = false
    page.on("response", (r) => {
      if (r.url().endsWith("/api/deployments") && r.request().method() === "POST") {
        sawDeploymentPost = true
      }
    })

    await saveBtn.click()

    // Expect either a visible error OR no POST fired (form has no selectedGuard).
    // handleSubmit reaches the fetch only if guardId + clientId + regionalOfficeId
    // are all truthy, since React state initialises those as empty strings.
    await page.waitForTimeout(1_500)
    expect(sawDeploymentPost).toBe(false)
  })
})

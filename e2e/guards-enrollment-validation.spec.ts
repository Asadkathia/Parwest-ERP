import { test, expect } from "@playwright/test"
import { fillValidGuardForm, submitAndRace } from "./helpers/guard-form"

test.describe("Guard Enrollment — client-side validators", () => {
  test("rejects CNIC that does not match XXXXX-XXXXXXX-X", async ({ page }) => {
    await fillValidGuardForm(page, { cnic: "12345-123456-1" }) // 6 digits in middle
    const result = await submitAndRace(page)
    expect(result.kind).toBe("validation")
    if (result.kind === "validation") {
      expect(result.text).toMatch(/CNIC format must be XXXXX-XXXXXXX-X/i)
    }
  })

  test("rejects CNIC Issue Date ≥ Expiry Date", async ({ page }) => {
    await fillValidGuardForm(page, {
      cnicIssueDate: "2025-01-01",
      cnicExpiryDate: "2020-01-01",
    })
    const result = await submitAndRace(page)
    expect(result.kind).toBe("validation")
    if (result.kind === "validation") {
      expect(result.text).toMatch(/CNIC Issue Date must be before the CNIC Expiry Date/i)
    }
  })

  test("rejects submit when Bank Accounts section is enabled but rows are empty", async ({
    page,
  }) => {
    await fillValidGuardForm(page)

    // Re-enable Bank Accounts section. GuardAccountsEditor auto-adds one
    // empty row — the validator should catch a missing Bank Name.
    const bankCheckbox = page
      .locator('label:has-text("GUARD BANK ACCOUNT DETAILS") >> input[type="checkbox"]')
      .first()
    await bankCheckbox.check()

    const result = await submitAndRace(page)
    expect(result.kind).toBe("validation")
    if (result.kind === "validation") {
      expect(result.text).toMatch(/bank account:.*(bank name|wallet type).*is required/i)
    }
  })
})

test.describe("Guard Enrollment — UI conditional fields", () => {
  test("marital status 'married' reveals child fields in Family Members", async ({ page }) => {
    await page.goto("/guards/new")

    // Ensure the Family section is expanded — collapse state is per-section
    // and has been observed to start collapsed in some runs.
    const expandFamily = page.getByRole("button", { name: /expand add family member detail/i })
    if (await expandFamily.isVisible().catch(() => false)) {
      await expandFamily.click()
    }

    const maritalSelect = page.locator('select[name="maritalStatus"]')
    await expect(maritalSelect).toBeVisible()

    const childCnic = page.locator('input[name="family_0_childCnic"]')

    // Default is "" — child fields must NOT be in the DOM.
    await expect(childCnic).toHaveCount(0)

    // 'married' reveals child fields.
    await maritalSelect.selectOption("married")
    await expect(childCnic).toBeVisible({ timeout: 5_000 })

    // Switching away hides them again.
    await maritalSelect.selectOption("single")
    await expect(childCnic).toHaveCount(0)
  })
})

import { test, expect, type Page } from "@playwright/test"
import { runId, cnic, phone, isoDate, PARWEST_ID_RE } from "./fixtures/data"

const RUN = runId()
const GUARD = {
  name: `QA Guard ${RUN}`,
  fatherName: "QA Father",
  motherName: "QA Mother",
  cnic: cnic(),
  phone: phone(1),
  dob: "1995-01-15",
  cnicIssueDate: "2015-06-01",
  cnicExpiryDate: "2035-06-01",
}

async function uncheckSection(page: Page, label: string) {
  const cb = page.locator(`label:has-text("${label}") >> input[type="checkbox"]`).first()
  if (await cb.isChecked()) await cb.click()
}

test.describe("Guard Enrollment — happy path", () => {
  test("creates a guard with minimum-required sections and returns a well-formed Parwest ID", async ({
    page,
  }) => {
    await page.goto("/guards/new")

    // Regional Office — pick the first real option (index 0 is the placeholder)
    const officeSelect = page.locator('select[name="regionalOfficeId"]')
    await expect(officeSelect).toBeVisible()
    const firstRealOption = officeSelect.locator("option").nth(1)
    const officeValue = await firstRealOption.getAttribute("value")
    expect(officeValue, "at least one RegionalOffice must be seeded").toBeTruthy()
    await officeSelect.selectOption(officeValue!)

    // Trim the form to the minimum required: uncheck optional sections that
    // would otherwise demand additional sub-rows or validators.
    for (const label of [
      "GUARD BANK ACCOUNT DETAILS",
      "PREVIOUS EMPLOYMENT DETAILS",
      "EDUCATION",
      "ADD FAMILY MEMBER DETAIL",
      "ADD NEAREST RELATIVE DETAIL",
    ]) {
      await uncheckSection(page, label)
    }

    // GENERAL
    await page.locator('input[name="name"]').fill(GUARD.name)
    await page.locator('input[name="fatherName"]').fill(GUARD.fatherName)
    await page.locator('input[name="motherName"]').fill(GUARD.motherName)
    await page.locator('input[name="dateOfBirth"]').fill(GUARD.dob)
    await page.locator('input[name="cnic"]').fill(GUARD.cnic)
    await page.locator('input[name="cnicIssueDate"]').fill(GUARD.cnicIssueDate)
    await page.locator('input[name="cnicExpiryDate"]').fill(GUARD.cnicExpiryDate)
    await page.locator('input[name="nextOfKin"]').fill("QA NOK")
    await page.locator('input[name="nationality"]').fill("Pakistani")
    await page.locator('input[name="phone"]').fill(GUARD.phone)
    await page.locator('input[name="sect"]').fill("Sunni")
    await page.locator('input[name="cast"]').fill("Rajput")
    await page.locator('input[name="joiningDate"]').fill(isoDate(-7))
    await page.locator('input[name="policeStation"]').fill("Model Town")
    await page.locator('select[name="bloodGroup"]').selectOption("O+ve")

    // ADDRESS (all required)
    await page.locator('input[name="addressCurrent"]').fill("House 1, Street 2, Lahore")
    await page.locator('input[name="currentAddressContact"]').fill("04212345678")
    await page.locator('input[name="addressPermanent"]').fill("Village X, District Y")
    await page.locator('input[name="permanentAddressContact"]').fill("04312345678")

    // INTRODUCER (FULL NAME required)
    await page.locator('input[name="introducerName"]').fill("Intro Name")

    // PHYSICAL (all six required)
    await page.locator('input[name="height"]').fill("5-9")
    await page.locator('input[name="weight"]').fill("70")
    await page.locator('input[name="eyeColor"]').fill("Brown")
    await page.locator('input[name="hairColor"]').fill("Black")
    await page.locator('input[name="disability"]').fill("None")
    await page.locator('input[name="identificationMark"]').fill("Mole on left cheek")

    // Intercept the POST so we can capture the created guard's ids reliably.
    const createResponse = page.waitForResponse(
      (r) => r.url().endsWith("/api/guards") && r.request().method() === "POST"
    )

    await page.locator('button[type="submit"]', { hasText: /submit|saving/i }).click()

    const res = await createResponse
    const body = await res.json().catch(() => ({}))

    // If the server rejected, surface its message in the assertion.
    expect(
      res.ok(),
      `POST /api/guards failed (${res.status()}): ${body?.message ?? JSON.stringify(body)}`
    ).toBe(true)

    const created = body?.data ?? body
    expect(created).toBeTruthy()
    expect(created.id, "response should include created guard id").toBeTruthy()
    expect(
      String(created.parwestId ?? ""),
      "parwestId must match PW-<series>-##### format"
    ).toMatch(PARWEST_ID_RE)

    // The form router.push()es back to /guards after success.
    await expect(page).toHaveURL(/\/guards(\?|$)/, { timeout: 15_000 })

    // The new guard should appear in the list.
    await expect(page.getByText(created.parwestId, { exact: true })).toBeVisible()
    await expect(page.getByText(GUARD.name, { exact: true })).toBeVisible()

    // And the detail page should load with status = PENDING.
    await page.goto(`/guards/${created.id}`)
    await expect(page.getByText(/pending/i).first()).toBeVisible({ timeout: 15_000 })
  })
})

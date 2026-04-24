import { expect, type Page } from "@playwright/test"
import { cnic, isoDate, runId } from "../fixtures/data"

export type GuardFormOverrides = Partial<{
  name: string
  fatherName: string
  motherName: string
  dob: string
  cnic: string
  cnicIssueDate: string
  cnicExpiryDate: string
  nextOfKin: string
  phoneDigits: string // 10 digits after +92- prefix
  sect: string
  cast: string
  policeStation: string
  addressCurrent: string
  currentAddressContact: string
  addressPermanent: string
  permanentAddressContact: string
  introducerName: string
  height: string
  weight: string
  eyeColor: string
  hairColor: string
  disability: string
  identificationMark: string
}>

export function validGuard(): Required<GuardFormOverrides> {
  const run = runId()
  return {
    name: `QA Guard ${run}`,
    fatherName: "QA Father",
    motherName: "QA Mother",
    dob: "1995-01-15",
    cnic: cnic(),
    cnicIssueDate: "2015-06-01",
    cnicExpiryDate: "2035-06-01",
    nextOfKin: "QA NOK",
    phoneDigits: "3001234567",
    sect: "Sunni",
    cast: "Rajput",
    policeStation: "Model Town",
    addressCurrent: "House 1, Street 2, Lahore",
    currentAddressContact: "04212345678",
    addressPermanent: "Village X, District Y",
    permanentAddressContact: "04312345678",
    introducerName: "Intro Name",
    height: "5-9",
    weight: "70",
    eyeColor: "Brown",
    hairColor: "Black",
    disability: "None",
    identificationMark: "Mole on left cheek",
  }
}

async function uncheckSection(page: Page, label: string) {
  const cb = page.locator(`label:has-text("${label}") >> input[type="checkbox"]`).first()
  if (await cb.isChecked()) await cb.click()
}

// PhoneInput reformats on each keystroke. Playwright's .fill() can land in a
// character-typing path where the intermediate 11-digit value trips the
// country-code-strip branch. Type the 10 digits at the end of the "+92-"
// prefix — this always hits the normal typing path.
async function fillPhone(page: Page, digits: string) {
  const input = page.locator('input[name="phone"]')
  await input.click()
  await input.press("End")
  await input.pressSequentially(digits, { delay: 5 })
}

/**
 * Opens /guards/new and fills in a valid guard profile. Callers can pass
 * overrides to change specific fields for negative-case tests.
 *
 * Returns the merged field values that were actually entered.
 */
export async function fillValidGuardForm(
  page: Page,
  overrides: GuardFormOverrides = {}
): Promise<Required<GuardFormOverrides>> {
  const g = { ...validGuard(), ...overrides }

  await page.goto("/guards/new")

  // Regional Office — pick the first real option (index 0 is the placeholder).
  const officeSelect = page.locator('select[name="regionalOfficeId"]')
  await expect(officeSelect).toBeVisible()
  const firstRealOption = officeSelect.locator("option").nth(1)
  const officeValue = await firstRealOption.getAttribute("value")
  expect(officeValue, "at least one RegionalOffice must be seeded").toBeTruthy()
  await officeSelect.selectOption(officeValue!)

  // Trim optional sections. Previous Employment can now be unchecked — its
  // validator is gated on the section checkbox (fixed).
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
  await page.locator('input[name="name"]').fill(g.name)
  await page.locator('input[name="fatherName"]').fill(g.fatherName)
  await page.locator('input[name="motherName"]').fill(g.motherName)
  await page.locator('input[name="dateOfBirth"]').fill(g.dob)
  await page.locator('input[name="cnic"]').fill(g.cnic)
  await page.locator('input[name="cnicIssueDate"]').fill(g.cnicIssueDate)
  await page.locator('input[name="cnicExpiryDate"]').fill(g.cnicExpiryDate)
  await page.locator('input[name="nextOfKin"]').fill(g.nextOfKin)
  await page.locator('input[name="nationality"]').fill("Pakistani")
  await fillPhone(page, g.phoneDigits)
  await page.locator('input[name="sect"]').fill(g.sect)
  await page.locator('input[name="cast"]').fill(g.cast)
  await page.locator('input[name="joiningDate"]').fill(isoDate(-7))
  await page.locator('input[name="policeStation"]').fill(g.policeStation)
  await page.locator('select[name="bloodGroup"]').selectOption("O+ve")

  // ADDRESS
  await page.locator('input[name="addressCurrent"]').fill(g.addressCurrent)
  await page.locator('input[name="currentAddressContact"]').fill(g.currentAddressContact)
  await page.locator('input[name="addressPermanent"]').fill(g.addressPermanent)
  await page.locator('input[name="permanentAddressContact"]').fill(g.permanentAddressContact)

  // INTRODUCER
  await page.locator('input[name="introducerName"]').fill(g.introducerName)

  // PHYSICAL
  await page.locator('input[name="height"]').fill(g.height)
  await page.locator('input[name="weight"]').fill(g.weight)
  await page.locator('input[name="eyeColor"]').fill(g.eyeColor)
  await page.locator('input[name="hairColor"]').fill(g.hairColor)
  await page.locator('input[name="disability"]').fill(g.disability)
  await page.locator('input[name="identificationMark"]').fill(g.identificationMark)

  return g
}

export async function clickSubmit(page: Page) {
  const btn = page.getByRole("button", { name: /^SUBMIT$/ })
  await btn.scrollIntoViewIfNeeded()
  await btn.click()
}

/**
 * Click SUBMIT and race the POST response against the client-side error banner.
 * Returns a discriminated union so callers can assert on either outcome.
 */
export async function submitAndRace(
  page: Page,
  { timeoutMs = 20_000 }: { timeoutMs?: number } = {}
): Promise<
  | { kind: "post"; status: number; body: unknown }
  | { kind: "validation"; text: string }
> {
  const errorBanner = page.locator(".bg-red-50").first()
  const createResponse = page.waitForResponse(
    (r) => r.url().endsWith("/api/guards") && r.request().method() === "POST",
    { timeout: timeoutMs }
  )

  await clickSubmit(page)

  const first = await Promise.race([
    createResponse.then(async (r) => ({
      kind: "post" as const,
      status: r.status(),
      body: await r.json().catch(() => ({})),
    })),
    errorBanner.waitFor({ state: "visible", timeout: timeoutMs }).then(async () => ({
      kind: "validation" as const,
      text: (await errorBanner.textContent())?.trim() ?? "",
    })),
  ])
  return first
}

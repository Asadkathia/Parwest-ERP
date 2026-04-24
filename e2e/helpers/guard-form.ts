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

  // Trim optional sections. ADD FAMILY MEMBER DETAIL and ADD NEAREST RELATIVE
  // DETAIL are now marked `required: true` — their checkboxes render disabled
  // and cannot be unchecked. The form accepts empty sub-rows so we leave them
  // rendered with no data.
  for (const label of [
    "GUARD BANK ACCOUNT DETAILS",
    "PREVIOUS EMPLOYMENT DETAILS",
    "EDUCATION",
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
  await page.locator('select[name="maritalStatus"]').selectOption("single")
  await page.locator('input[name="profileIntroducer"]').fill("QA Profile Introducer")

  // Supervisor is a required hidden input (supervisorId) backed by a typeahead
  // populated after Regional Office is picked.
  const supervisorBox = page.locator('input[placeholder^="Search supervisor"]').first()
  const supervisorHidden = page.locator('input[type="hidden"][name="supervisorId"]')
  if (await supervisorBox.count()) {
    await supervisorBox.click()
    // Wait for the async fetch to populate the dropdown.
    const firstUser = page
      .locator('.absolute.z-50 button[type="button"]')
      .filter({ has: page.locator("span.font-medium") })
      .first()
    await firstUser.waitFor({ state: "visible", timeout: 10_000 })
    // onMouseDown (not onClick) is what the component listens to.
    await firstUser.dispatchEvent("mousedown")
    // Confirm the hidden input now has a value.
    await expect(supervisorHidden).not.toHaveValue("", { timeout: 5_000 })
  }

  // ADDRESS
  await page.locator('input[name="addressCurrent"]').fill(g.addressCurrent)
  await page.locator('input[name="currentAddressContact"]').fill(g.currentAddressContact)
  await page.locator('input[name="addressPermanent"]').fill(g.addressPermanent)
  await page.locator('input[name="permanentAddressContact"]').fill(g.permanentAddressContact)

  // INTRODUCER
  await page.locator('input[name="introducerName"]').fill(g.introducerName)

  // FAMILY MEMBER — every Name/Relation/Age/Profession/Address is required.
  if (await page.locator('input[name="family_0_name"]').count()) {
    await page.locator('input[name="family_0_name"]').fill("QA Family Member")
    await page.locator('input[name="family_0_relation"]').fill("Brother")
    await page.locator('input[name="family_0_age"]').fill("28")
    await page.locator('input[name="family_0_profession"]').fill("Teacher")
    await page.locator('input[name="family_0_address"]').fill("Village X")
  }
  // NEAREST RELATIVE — Name/Father/Relation/Profession/CNIC/CNIC Issue/Contact/Address required.
  if (await page.locator('input[name="nearest_0_name"]').count()) {
    await page.locator('input[name="nearest_0_name"]').fill("QA Nearest Relative")
    await page.locator('input[name="nearest_0_fatherName"]').fill("QA Uncle")
    await page.locator('input[name="nearest_0_relation"]').fill("Uncle")
    await page.locator('input[name="nearest_0_profession"]').fill("Farmer")
    await page.locator('input[name="nearest_0_cnic"]').fill("42101-7654321-1")
    await page.locator('input[name="nearest_0_cnicIssueDate"]').fill("2015-06-01")
    await page.locator('input[name="nearest_0_contact"]').fill("+92-301-1111111")
    await page.locator('input[name="nearest_0_address"]').fill("Village X")
  }

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

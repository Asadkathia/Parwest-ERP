import { expect, type Page } from "@playwright/test"
import { runId } from "../fixtures/data"
import { pickFirstSearchSelectOption } from "./search-select"

export type ClientFormOverrides = Partial<{
  name: string
  email: string
  contactPerson: string
  phone: string
  headOfficeAddress: string
  defaultBranchName: string
}>

export function validClient(): Required<ClientFormOverrides> {
  const run = runId()
  return {
    name: `QA Client ${run}`,
    email: `qa-${run.toLowerCase()}@example.test`,
    contactPerson: "QA Contact",
    // Form now validates this client-side against +92-XXX-XXXXXXX.
    phone: "+92-300-1234567",
    headOfficeAddress: "Gulberg, Lahore",
    defaultBranchName: `QA Branch ${run}`,
  }
}

/**
 * Navigates to /clients/new in the requested mode and fills the required fields
 * for a valid submit. Returns the values used.
 */
export async function fillValidClientForm(
  page: Page,
  opts: { mode: "branch" | "branchless" } & ClientFormOverrides = { mode: "branchless" }
): Promise<Required<ClientFormOverrides> & { mode: "branch" | "branchless"; typeValue: string }> {
  const { mode, ...fieldOverrides } = opts
  const c = { ...validClient(), ...fieldOverrides }

  await page.goto(`/clients/new?mode=${mode}`)

  // The mode toggle is visual — verify the hidden flag matches what we asked for.
  const hiddenIsBranchless = page.locator('input[type="hidden"][name="isBranchless"]').first()
  await expect(hiddenIsBranchless).toHaveValue(mode === "branchless" ? "true" : "false")

  // Core
  await page.locator('input[name="name"]').fill(c.name)
  await page.locator('input[name="email"]').fill(c.email)
  // enrollmentDate defaults to today — leave as is.

  // Client Type (SearchSelect populated async from /api/client-types).
  const typeHidden = page.locator('input[type="hidden"][name="type"]').first()
  await expect(typeHidden).toBeAttached()
  // Wait for the trigger to stop saying "Loading types…".
  const typeTrigger = typeHidden.locator("..").locator(".ui-input").first()
  await expect(typeTrigger).not.toContainText(/loading/i, { timeout: 15_000 })
  const typeValue = await pickFirstSearchSelectOption(page, "type")

  // Contact — first contact-number input is the primary (required). The
  // placeholder was recently changed to the phone format template.
  await page.locator('input[name="contactPerson"]').fill(c.contactPerson)
  await page
    .locator('input[placeholder="+92-300-1234567"]')
    .first()
    .fill(c.phone)

  // Optional PhoneInput fields are left untouched — the server-side validator
  // now treats bare "+92-" (the prefix-only value PhoneInput renders by
  // default) as empty, so an untouched field no longer trips submit.

  // Location (SearchSelect for clientLocation defaults to Lahore — leave as is).

  // Head Office Address
  await page.locator('textarea[name="headOfficeAddress"]').fill(c.headOfficeAddress)

  // NOTE: In branch mode, the form does NOT expose a branch-name field on
  // /clients/new — the flow is: save client → success card → "Add a Branch"
  // link to /clients/[id]/branches/new. So the POSTed defaultBranchName is
  // empty and the server creates zero branches. The `default_branch_name`
  // input only renders in branchless mode (as the "Default Branch" name).
  if (mode === "branchless") {
    // Leaving default_branch_name empty is fine — the hidden input defaults to
    // the "__branchless_default__" sentinel which the server maps to "Default
    // Branch". But we fill the user-facing input so we can assert on the name.
    await page.locator('input[name="default_branch_name"]').fill(c.defaultBranchName)
  }

  return { ...c, mode, typeValue }
}

export async function clickSaveClient(page: Page) {
  const btn = page.getByRole("button", { name: /^Save Client$/ })
  await btn.scrollIntoViewIfNeeded()
  await btn.click()
}

export async function submitClientAndRace(
  page: Page,
  { timeoutMs = 20_000 }: { timeoutMs?: number } = {}
): Promise<
  | { kind: "post"; status: number; body: unknown }
  | { kind: "validation"; text: string }
> {
  const errorBanner = page.locator(".bg-red-50").first()
  const createResponse = page.waitForResponse(
    (r) => r.url().endsWith("/api/clients") && r.request().method() === "POST",
    { timeout: timeoutMs }
  )

  await clickSaveClient(page)

  return Promise.race([
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
}

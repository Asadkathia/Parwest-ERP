import { expect, type Page } from "@playwright/test"
import { runId } from "../fixtures/data"

export type ProductOverrides = Partial<{
  name: string
  sku: string
  description: string
}>

export function validProduct(): Required<ProductOverrides> {
  const run = runId()
  return {
    name: `QA Product ${run}`,
    sku: `QA-SKU-${run}`,
    description: "QA-generated product",
  }
}

/**
 * Navigate to /store-inventory/product-create and fill the minimum required
 * fields. Reference-data dropdowns (Category / Brand / Unit / Status / Condition)
 * are optional for product creation — the server only requires sku + name.
 *
 * Returns the values used so tests can assert against them.
 */
export async function fillValidProductForm(
  page: Page,
  overrides: ProductOverrides = {}
): Promise<Required<ProductOverrides>> {
  const p = { ...validProduct(), ...overrides }

  await page.goto("/store-inventory/product-create")
  await expect(page.getByRole("heading", { name: /create product/i })).toBeVisible()

  // Name + SKU are the only server-required fields.
  const nameInput = page
    .locator("label", { hasText: /^Name \*$/ })
    .locator("..")
    .locator("input")
    .first()
  const skuInput = page
    .locator("label", { hasText: /^SKU \*$/ })
    .locator("..")
    .locator("input")
    .first()

  await nameInput.fill(p.name)
  await skuInput.fill(p.sku)

  return p
}

export async function clickCreateProduct(page: Page) {
  await page
    .getByRole("button", { name: /^Create Product$/ })
    .click()
}

/**
 * Click Create and race the POST response against the red InlineAlert error.
 */
export async function submitProductAndRace(
  page: Page,
  { timeoutMs = 20_000 }: { timeoutMs?: number } = {}
): Promise<
  | { kind: "post"; status: number; body: unknown }
  | { kind: "validation"; text: string }
> {
  const errorAlert = page.locator(".bg-red-50").first()
  const createResponse = page.waitForResponse(
    (r) =>
      r.url().includes("/api/store-inventory/v2/products") &&
      !r.url().includes("masters/") &&
      r.request().method() === "POST",
    { timeout: timeoutMs }
  )

  await clickCreateProduct(page)

  return Promise.race([
    createResponse.then(async (r) => ({
      kind: "post" as const,
      status: r.status(),
      body: await r.json().catch(() => ({})),
    })),
    errorAlert.waitFor({ state: "visible", timeout: timeoutMs }).then(async () => ({
      kind: "validation" as const,
      text: (await errorAlert.textContent())?.trim() ?? "",
    })),
  ])
}

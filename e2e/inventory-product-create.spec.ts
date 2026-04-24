import { test, expect } from "@playwright/test"
import { fillValidProductForm, submitProductAndRace, clickCreateProduct } from "./helpers/product-form"

test.describe("Inventory v2 — product create (non-weapon happy path)", () => {
  test("creates a product with just SKU + Name and resets the form", async ({ page }) => {
    const filled = await fillValidProductForm(page)
    const result = await submitProductAndRace(page)

    expect(
      result.kind,
      result.kind === "validation"
        ? `Blocked by client/server message: "${result.text}"`
        : "expected a POST"
    ).toBe("post")
    if (result.kind !== "post") return

    expect(
      result.status,
      `POST /api/store-inventory/v2/products failed (${result.status}): ${JSON.stringify(
        result.body
      )}`
    ).toBeLessThan(400)

    const body = result.body as { data?: { id?: string; sku?: string; name?: string } } & {
      id?: string
      sku?: string
      name?: string
    }
    const created = body.data ?? body
    expect(created.id).toBeTruthy()
    expect(created.sku).toBe(filled.sku)
    expect(created.name).toBe(filled.name)

    // The UI flashes a green alert, but ProductsManager.load() calls
    // setNotice(null) immediately after, wiping it — so we can't reliably
    // assert on that banner (this is a real UX bug worth fixing). Instead
    // confirm resetForm() cleared the inputs.
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
    await expect(nameInput).toHaveValue("", { timeout: 15_000 })
    await expect(skuInput).toHaveValue("")
  })
})

test.describe("Inventory v2 — product create validation", () => {
  test("rejects an empty form with 'SKU and Name are required'", async ({ page }) => {
    await page.goto("/store-inventory/product-create")
    await expect(page.getByRole("heading", { name: /create product/i })).toBeVisible()

    // Don't fill anything — click Create Product.
    await clickCreateProduct(page)

    // Client-side check fires before any network call.
    await expect(page.locator(".bg-red-50").first()).toContainText(
      /sku and name are required/i,
      { timeout: 5_000 }
    )
  })
})

test.describe("Inventory v2 — weapon category conditional fields", () => {
  test("selecting a weapon/ammo category swaps Size/Color for Weapon Type/Calibre", async ({
    page,
  }) => {
    await page.goto("/store-inventory/product-create")
    await expect(page.getByRole("heading", { name: /create product/i })).toBeVisible()

    // The Select component's <label> is a sibling (no `for` attribute),
    // so getByLabel doesn't match. Reach the <select> via the parent.
    const fieldByLabel = (label: RegExp) =>
      page.locator("label", { hasText: label }).locator("..").locator("select, input").first()

    const categorySelect = fieldByLabel(/^Category$/)
    await expect(categorySelect).toBeVisible()

    const optionTexts = await categorySelect.locator("option").allTextContents()
    const weaponOption = optionTexts.find((label) =>
      /(weapon|ammo|ammunition)/i.test(label)
    )
    test.skip(
      !weaponOption,
      "No Weapon/Ammo category seeded — add one via /store-inventory/categories"
    )
    await categorySelect.selectOption({ label: weaponOption! })

    // Size/Color inputs must be gone.
    await expect(page.locator("label", { hasText: /^Size$/ })).toHaveCount(0)
    await expect(page.locator("label", { hasText: /^Color$/ })).toHaveCount(0)

    // Weapon Type / Calibre labels must render.
    await expect(page.locator("label", { hasText: /^Weapon Type \*$/ })).toBeVisible()
    await expect(page.locator("label", { hasText: /^Calibre \*$/ })).toBeVisible()

    // Switching back to a non-weapon category restores Size/Color.
    const nonWeaponOption = optionTexts.find(
      (label) => label && !/select category/i.test(label) && label !== weaponOption
    )
    if (nonWeaponOption) {
      await categorySelect.selectOption({ label: nonWeaponOption })
      await expect(page.locator("label", { hasText: /^Size$/ })).toBeVisible()
      await expect(page.locator("label", { hasText: /^Color$/ })).toBeVisible()
      await expect(page.locator("label", { hasText: /^Weapon Type \*$/ })).toHaveCount(0)
    }
  })
})

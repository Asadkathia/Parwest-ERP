import { expect, type Page, type Locator } from "@playwright/test"

/**
 * Helpers for the project's custom SearchSelect component
 * (src/components/ui/SearchSelect.tsx).
 *
 * Shape:
 *   <div className="relative">
 *     <input type="hidden" name={name} ...>      ← form value
 *     <div className="ui-input ...">             ← clickable trigger
 *       ... placeholder or search input ...
 *     </div>
 *     {open && <div className="absolute z-[2000] ...">   ← option panel
 *       <button type="button">{label}</button>
 *     </div>}
 *   </div>
 */

function getRoot(page: Page, name: string): Locator {
  // The hidden input is inside the SearchSelect root div.
  return page.locator(`input[type="hidden"][name="${name}"]`).first().locator("..")
}

export async function openSearchSelect(page: Page, name: string): Promise<Locator> {
  const root = getRoot(page, name)
  await expect(root).toBeAttached()
  const trigger = root.locator(".ui-input").first()
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  const panel = root.locator("div.absolute")
  await panel.waitFor({ state: "visible", timeout: 5_000 })
  return panel
}

export async function pickSearchSelectOption(
  page: Page,
  name: string,
  label: string | RegExp
): Promise<string> {
  const panel = await openSearchSelect(page, name)
  const option = panel.getByRole("button", { name: label }).first()
  await option.click()

  const hidden = page.locator(`input[type="hidden"][name="${name}"]`).first()
  await expect(hidden).not.toHaveValue("")
  return hidden.inputValue()
}

export async function pickFirstSearchSelectOption(page: Page, name: string): Promise<string> {
  const panel = await openSearchSelect(page, name)
  const firstOption = panel.getByRole("button").first()
  await firstOption.waitFor({ state: "visible", timeout: 5_000 })
  const label = (await firstOption.textContent())?.trim() ?? ""
  await firstOption.click()

  const hidden = page.locator(`input[type="hidden"][name="${name}"]`).first()
  await expect(hidden, `no option selected for ${name} (first option label: "${label}")`).not.toHaveValue("")
  return hidden.inputValue()
}

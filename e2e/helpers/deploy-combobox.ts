import { expect, type Page, type Locator } from "@playwright/test"

/**
 * Helpers for the deploy form's inline SearchableCombobox component
 * (src/app/(dashboard)/guards/deploy/form.tsx:1211).
 *
 * Shape:
 *   <div>
 *     <label>{label}{required ? "*" : ""}</label>
 *     <div class="relative">
 *       <div class="ui-select ...">trigger</div>
 *       {open && (
 *         <div class="absolute z-50 ...">
 *           <input placeholder="Type to search..." />
 *           <div class="max-h-56 ...">
 *             <div class="cursor-pointer ...">option label</div>
 *             ...
 *           </div>
 *         </div>
 *       )}
 *     </div>
 *   </div>
 */

function root(page: Page, label: string | RegExp): Locator {
  return page.locator("label", { hasText: label }).locator("..").first()
}

export async function openDeployCombobox(page: Page, label: string | RegExp): Promise<Locator> {
  const r = root(page, label)
  await expect(r).toBeVisible()
  const trigger = r.locator(".ui-select").first()
  // Wait until the combobox is actually rendered (branch combobox renders
  // a plain `.ui-input` placeholder while branches are loading).
  await expect(trigger).toBeVisible({ timeout: 15_000 })
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  const panel = r.locator(".absolute.z-50")
  await panel.waitFor({ state: "visible", timeout: 5_000 })
  return panel
}

export async function pickDeployCombobox(
  page: Page,
  label: string | RegExp,
  optionMatch: string | RegExp
): Promise<string> {
  const panel = await openDeployCombobox(page, label)
  const searchBox = panel.locator('input[placeholder="Type to search..."]').first()

  // Narrow the list if a string was given.
  if (typeof optionMatch === "string") {
    await searchBox.fill(optionMatch)
  }

  // Options render as <div class="cursor-pointer ...">. The visible text
  // includes an optional "ID — Name" prefix — match on the containing div.
  const option = panel
    .locator(".cursor-pointer")
    .filter({ hasText: optionMatch })
    .first()
  await expect(option, `no option found matching ${optionMatch}`).toBeVisible({ timeout: 5_000 })
  const label_ = (await option.textContent())?.trim() ?? ""
  await option.click()

  // Trigger should now display the selected label.
  const trigger = root(page, label).locator(".ui-select").first()
  await expect(trigger).not.toHaveClass(/opacity-50/)
  return label_
}

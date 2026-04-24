import { expect, type Page } from "@playwright/test"
import { LIFECYCLE } from "./lifecycle-fixtures"
import { pickDeployCombobox } from "./deploy-combobox"

export type DeployOverrides = Partial<{
  guardParwestId: string
  shift: "DAY" | "NIGHT" | "BOTH"
  dailyRate: string
}>

/**
 * Navigates to /guards/deploy and fills the form selecting the given guard
 * from the lifecycle fixture. Does NOT submit — callers control the submit
 * step so they can assert on the response/banner.
 */
export async function fillDeployForm(
  page: Page,
  overrides: DeployOverrides = {}
): Promise<Required<DeployOverrides>> {
  const opts = {
    guardParwestId: LIFECYCLE.guards.assigned.parwestId,
    shift: "DAY" as const,
    dailyRate: "1500",
    ...overrides,
  }

  await page.goto("/guards/deploy")
  await expect(page.getByRole("heading", { name: /deploy guards/i }).first()).toBeVisible()

  await pickDeployCombobox(
    page,
    /^Regional Office\s*\*?$/,
    new RegExp(`${LIFECYCLE.office.name} \\(${LIFECYCLE.office.seriesCode}\\)`)
  )
  await pickDeployCombobox(
    page,
    /^Select Client\s*\*?$/,
    new RegExp(LIFECYCLE.client.name)
  )
  await pickDeployCombobox(
    page,
    /^Branch\s*\*+$/,
    new RegExp(LIFECYCLE.branch.name)
  )
  await pickDeployCombobox(page, /^Deploy As\s*\*+$/, /^Guard$/)

  // Narrow guard dropdown.
  await page
    .locator('input[placeholder="e.g. PW-00123 or type a name..."]')
    .fill(opts.guardParwestId)

  await pickDeployCombobox(
    page,
    /^Select Guard\s*\*?$/,
    opts.guardParwestId
  )

  await pickDeployCombobox(
    page,
    /^Shift\s*\*?$/,
    new RegExp(`^${opts.shift}$`, "i")
  )

  await page
    .locator("label", { hasText: /Daily Rate/i })
    .locator("..")
    .locator('input[type="number"]')
    .fill(opts.dailyRate)

  return opts
}

export async function clickDeploySave(page: Page) {
  await page.getByRole("button", { name: /^Save$/ }).click()
}

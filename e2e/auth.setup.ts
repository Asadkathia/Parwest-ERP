import { test as setup, expect } from "@playwright/test"
import path from "node:path"

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@parwestgroup.com"
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123@"

const authFile = path.join(__dirname, ".auth/admin.json")

setup("authenticate as SuperAdmin", async ({ page }) => {
  await page.goto("/login")
  await page.locator('input[name="email"]').fill(ADMIN_EMAIL)
  await page.locator('input[name="password"]').fill(ADMIN_PASSWORD)
  await Promise.all([
    page.waitForURL(url => !/\/login(\?|$)/.test(url.pathname), { timeout: 30_000 }),
    page.locator('button[type="submit"]').click(),
  ])

  await expect(page).not.toHaveURL(/\/login/)
  await page.context().storageState({ path: authFile })
})

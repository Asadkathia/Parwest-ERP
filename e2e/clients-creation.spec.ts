import { test, expect } from "@playwright/test"
import { fillValidClientForm, submitClientAndRace } from "./helpers/client-form"

test.describe("Client Creation — happy paths", () => {
  test("branchless client: creates and redirects to /clients", async ({ page }) => {
    const filled = await fillValidClientForm(page, { mode: "branchless" })
    const result = await submitClientAndRace(page)

    expect(
      result.kind,
      result.kind === "validation"
        ? `Client-side validation blocked submit: "${result.text}"`
        : "expected POST"
    ).toBe("post")
    if (result.kind !== "post") return

    expect(
      result.status,
      `POST /api/clients failed (${result.status}): ${JSON.stringify(result.body)}`
    ).toBeLessThan(400)

    const body = result.body as { id?: string; name?: string; isBranchless?: boolean }
    expect(body.id).toBeTruthy()
    expect(body.name).toBe(filled.name)
    // NOTE: body.isBranchless is intentionally NOT asserted here — see the
    // dedicated "server mis-handles boolean isBranchless" test below, which
    // documents that the client posts a boolean while the server checks for
    // the string "true".

    // Branchless mode redirects to /clients.
    await expect(page).toHaveURL(/\/clients(\?|$)/, { timeout: 15_000 })
  })

  test("branch client: creates with zero branches and shows success card with View Client + Add a Branch", async ({
    page,
  }) => {
    // Branch-mode /clients/new does NOT expose a branch-name input — the UX
    // is: save client first, then follow the success card's "Add a Branch"
    // link to /clients/[id]/branches/new. So the expected outcome is a client
    // with isBranchless=false and an empty branches array.
    const filled = await fillValidClientForm(page, { mode: "branch" })
    const result = await submitClientAndRace(page)

    expect(result.kind).toBe("post")
    if (result.kind !== "post") return
    expect(result.status).toBeLessThan(400)

    const body = result.body as {
      id?: string
      name?: string
      isBranchless?: boolean
      branches?: unknown[]
    }
    expect(body.id).toBeTruthy()
    expect(body.isBranchless).toBe(false)
    // No branch-name field on this form → server creates zero branches.
    expect(Array.isArray(body.branches)).toBe(true)
    expect(body.branches!.length).toBe(0)

    // Success card copy reflects "no branch yet" + an "Add a Branch" link.
    await expect(page.getByText(`${filled.name} saved!`)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/no branch was added yet/i)).toBeVisible()
    await expect(page.getByRole("link", { name: /view client/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /^\s*add a branch\s*$/i })).toBeVisible()
  })
})

test.describe("Client Creation — isBranchless persistence", () => {
  // Regression guard for the boolean/string coercion fix in api/clients/route.ts.
  // Server now accepts body.isBranchless as either true (boolean) or "true" (string).
  test("branchless-mode POST persists isBranchless=true on the server", async ({ page }) => {
    await fillValidClientForm(page, { mode: "branchless" })
    const result = await submitClientAndRace(page)
    expect(result.kind).toBe("post")
    if (result.kind !== "post") return
    const body = result.body as { isBranchless?: boolean }
    expect(body.isBranchless).toBe(true)
  })

  test("branch-mode POST persists isBranchless=false on the server", async ({ page }) => {
    await fillValidClientForm(page, { mode: "branch" })
    const result = await submitClientAndRace(page)
    expect(result.kind).toBe("post")
    if (result.kind !== "post") return
    const body = result.body as { isBranchless?: boolean }
    expect(body.isBranchless).toBe(false)
  })
})

test.describe("Client Creation — mode toggle", () => {
  test("mode=branch vs mode=branchless flips the isBranchless hidden flag", async ({ page }) => {
    await page.goto("/clients/new?mode=branch")
    await expect(
      page.locator('input[type="hidden"][name="isBranchless"]').first()
    ).toHaveValue("false")

    await page.goto("/clients/new?mode=branchless")
    await expect(
      page.locator('input[type="hidden"][name="isBranchless"]').first()
    ).toHaveValue("true")
  })
})

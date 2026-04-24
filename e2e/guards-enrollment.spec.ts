import { test, expect } from "@playwright/test"
import { PARWEST_ID_RE } from "./fixtures/data"
import { fillValidGuardForm, submitAndRace } from "./helpers/guard-form"

test.describe("Guard Enrollment — happy path", () => {
  test("creates a guard with minimum-required sections and returns a well-formed Parwest ID", async ({
    page,
  }) => {
    const filled = await fillValidGuardForm(page)
    const result = await submitAndRace(page)

    expect(
      result.kind,
      result.kind === "validation"
        ? `Client-side validation blocked submit: "${result.text}"`
        : "expected server response"
    ).toBe("post")
    if (result.kind !== "post") return // type narrowing

    expect(
      result.status,
      `POST /api/guards failed (${result.status}): ${JSON.stringify(result.body)}`
    ).toBeLessThan(400)

    const body = result.body as Record<string, unknown> | null
    const created = (body && "data" in (body as object) ? (body as { data: unknown }).data : body) as
      | { id?: string; parwestId?: string }
      | null
    expect(created?.id, "response should include created guard id").toBeTruthy()
    expect(
      String(created?.parwestId ?? ""),
      "parwestId must match PW-<series>-##### format"
    ).toMatch(PARWEST_ID_RE)

    // handleSubmit calls router.push("/guards") after success.
    await expect(page).toHaveURL(/\/guards(\?|$)/, { timeout: 15_000 })

    // Detail page loads, shows the guard's name and PENDING status.
    await page.goto(`/guards/${created!.id}`)
    await expect(page.getByText(filled.name).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/pending/i).first()).toBeVisible({ timeout: 15_000 })
  })
})

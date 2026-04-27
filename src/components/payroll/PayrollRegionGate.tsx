import { Suspense, type ReactNode } from "react"
import { Wallet } from "lucide-react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { isSuperAdmin } from "@/lib/api/permissions"
import { deriveRegionalScope } from "@/lib/access/scope"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

/**
 * Shared region-gate scaffold for payroll sub-pages.
 *
 * Mirrors the pattern established in `src/app/(dashboard)/users/page.tsx`:
 *   - SuperAdmin without a `?regionId=` URL param sees a "Select a region" prompt.
 *   - Regional users get an auto-locked picker (their scope.regionId).
 *   - Otherwise the `children` (the real payroll client) renders.
 *
 * Server components cannot read URL search params on their own, so the caller
 * page passes `searchParams` through. The helper computes the resolved
 * `effectiveRegionId`, the available `pickerRegions`, and the `locked` flag.
 *
 * UI placement:
 *   - When the gate is satisfied (a region is resolved, or scope is locked),
 *     this helper returns ONLY the children — managers embed
 *     `<RegionUrlPicker>` as the first cell of their advanced-filter row so
 *     the picker visually merges with the rest of the controls.
 *   - When the gate is active (SuperAdmin without a selection), the helper
 *     falls back to a standalone picker card + prompt — there's no manager
 *     filter row to host it yet.
 */
export type PayrollRegionGateResult = {
  /** True when SuperAdmin hasn't picked a region yet. */
  needsRegionGate: boolean
  /** Effective regionId filter (URL override wins for SuperAdmin). */
  effectiveRegionId: string | null
  /** Pre-rendered scaffold: picker + prompt (gate active) or `children`. */
  node: ReactNode
}

export async function renderPayrollRegionGate({
  searchParams,
  children,
  promptText = "Select a region to view payroll data.",
  promptHint = "Payroll data is region-scoped. Choose a region above to load it.",
}: {
  searchParams: Promise<{ regionId?: string }>
  /**
   * The child(ren) to render when the gate is satisfied. Accepts either a
   * ReactNode or a render callback that receives the resolved
   * `effectiveRegionId`, the (already region-scoped) `pickerRegions`, and the
   * `locked` flag — the manager should embed `<RegionUrlPicker>` as the first
   * cell of its own advanced-filter grid.
   */
  children:
    | ReactNode
    | ((ctx: {
        effectiveRegionId: string | null
        pickerRegions: { id: string; name: string }[]
        locked: boolean
        superAdmin: boolean
      }) => ReactNode)
  promptText?: string
  promptHint?: string
}): Promise<PayrollRegionGateResult> {
  const session = await auth()
  if (!session) redirect("/login")

  const superAdmin = isSuperAdmin(session)
  const scope = deriveRegionalScope(session)

  const { regionId: urlRegionId = "" } = await searchParams
  const needsRegionGate = superAdmin && !urlRegionId

  const regions = await prisma.region
    .findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
    .catch(() => [] as { id: string; name: string }[])

  const pickerRegions = scope?.regionId
    ? regions.filter((r) => r.id === scope.regionId)
    : regions

  const locked = Boolean(scope?.regionId)
  const effectiveRegionId = superAdmin ? (urlRegionId || null) : (scope?.regionId ?? null)

  if (needsRegionGate) {
    // SuperAdmin hasn't picked a region — there's no manager filter row to
    // host the picker yet, so render a standalone picker card + prompt.
    const node = (
      <>
        <section className="ui-card p-5">
          <Suspense>
            <RegionUrlPicker
              regions={pickerRegions}
              locked={false}
              includeGlobalOption={superAdmin}
            />
          </Suspense>
        </section>
        <div className="ui-card p-10 text-center">
          <Wallet className="mx-auto mb-3 h-8 w-8 text-[var(--text-muted)]" />
          <p className="text-base font-medium text-[var(--text)]">{promptText}</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{promptHint}</p>
        </div>
      </>
    )
    return { needsRegionGate, effectiveRegionId, node }
  }

  const resolvedChildren =
    typeof children === "function"
      ? (
          children as (ctx: {
            effectiveRegionId: string | null
            pickerRegions: { id: string; name: string }[]
            locked: boolean
            superAdmin: boolean
          }) => ReactNode
        )({
          effectiveRegionId,
          pickerRegions,
          locked,
          superAdmin,
        })
      : children

  return { needsRegionGate, effectiveRegionId, node: resolvedChildren }
}

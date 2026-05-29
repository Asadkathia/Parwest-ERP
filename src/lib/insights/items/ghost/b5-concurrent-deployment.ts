import { registerInsight } from "@/lib/insights/registry"
import { buildManagerScopeWhere } from "@/lib/access/scope"

/**
 * B5 — Concurrent deployments (true conflicts only).
 *
 * The system legitimately allows up to 2 active deployments per guard for
 * day+night double-duty (one DAY + one NIGHT). So a raw `_count > 1` is NOT an
 * anomaly. This insight mirrors the shift-conflict predicate enforced by the
 * create route (`src/app/api/deployments/route.ts`) so detection matches
 * enforcement. A guard is a TRUE conflict when any of these hold across their
 * ACTIVE deployments:
 *   • more than 2 active deployments, OR
 *   • any active deployment with shiftType=BOTH alongside another active row, OR
 *   • two active deployments sharing the same shiftType (e.g. DAY + DAY).
 */

type ShiftType = "DAY" | "NIGHT" | "BOTH"

function isShiftConflict(shifts: ShiftType[]): boolean {
  // More than the allowed cap of 2 concurrent active deployments.
  if (shifts.length > 2) return true
  if (shifts.length < 2) return false

  // BOTH cannot coexist with any other active deployment.
  if (shifts.includes("BOTH")) return true

  // Same shift type held twice (e.g. DAY + DAY or NIGHT + NIGHT) — overlap.
  const dayCount = shifts.filter((s) => s === "DAY").length
  const nightCount = shifts.filter((s) => s === "NIGHT").length
  if (dayCount > 1 || nightCount > 1) return true

  // Remaining case: exactly one DAY + one NIGHT — legitimate double-duty.
  return false
}

registerInsight({
  key: "concurrent-deployment",
  title: "B5 — Concurrent deployments",
  description:
    "Guards holding conflicting ACTIVE deployments — overlapping shifts, a BOTH-shift alongside another, or more than the allowed 2 active.",
  category: "ANOMALY",
  defaultSeverity: "HIGH",
  compute: async (ctx) => {
    const scopeWhere = buildManagerScopeWhere(ctx.scope, {
      regionalOfficeId: "regionalOfficeId",
    })

    // Only guards with >1 active deployment can possibly conflict, so pre-filter
    // via groupBy, then validate each against the enforced shift-conflict rule.
    const groups = await ctx.prisma.deployment.groupBy({
      by: ["guardId"],
      where: { status: "ACTIVE", ...scopeWhere },
      _count: { guardId: true },
      having: { guardId: { _count: { gt: 1 } } },
      orderBy: { _count: { guardId: "desc" } },
    })

    if (groups.length === 0) {
      return { count: 0, summary: "No guards with conflicting active deployments." }
    }

    const candidateIds = groups.map((g) => g.guardId)
    const activeRows = await ctx.prisma.deployment.findMany({
      where: { status: "ACTIVE", guardId: { in: candidateIds }, ...scopeWhere },
      select: { guardId: true, shiftType: true },
    })

    const shiftsByGuard = new Map<string, ShiftType[]>()
    for (const row of activeRows) {
      const list = shiftsByGuard.get(row.guardId) ?? []
      list.push(row.shiftType as ShiftType)
      shiftsByGuard.set(row.guardId, list)
    }

    const conflicting = candidateIds.filter((guardId) =>
      isShiftConflict(shiftsByGuard.get(guardId) ?? [])
    )

    const count = conflicting.length
    if (count === 0) {
      return { count: 0, summary: "No guards with conflicting active deployments." }
    }

    const top = conflicting.slice(0, 5)
    const guards = await ctx.prisma.guard.findMany({
      where: { id: { in: top } },
      select: { id: true, name: true, parwestId: true },
    })

    const items = top.map((guardId) => {
      const guard = guards.find((x) => x.id === guardId)
      const shifts = shiftsByGuard.get(guardId) ?? []
      return {
        id: guardId,
        label: guard?.name ?? "(unknown guard)",
        sub: `${guard?.parwestId ?? ""} — ${shifts.length} active (${shifts.join(", ")})`,
        href: `/guards/${guardId}`,
      }
    })

    return {
      count,
      summary: `${count} guard${count === 1 ? "" : "s"} with conflicting active deployments.`,
      drillUrl: "/deployments?status=ACTIVE",
      items,
      severity: "HIGH",
    }
  },
})

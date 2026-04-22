import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { ok, forbidden, unauthorized } from "@/lib/api/response"
import { runAllInsights } from "@/lib/insights/registry"
import { resolveDashboardRole } from "@/lib/dashboard/role"

function canSeeInsights(role: ReturnType<typeof resolveDashboardRole>): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN_REGIONAL" || role === "ACCOUNTANT"
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) return unauthorized()

  const role = resolveDashboardRole(session)
  if (!canSeeInsights(role)) return forbidden("Insights are restricted to admins and accountants.")

  const url = new URL(request.url)
  const category = url.searchParams.get("category") as "EFFICIENCY" | "ANOMALY" | null
  const includeMuted = url.searchParams.get("includeMuted") === "1"

  const results = await runAllInsights(session, {
    category: category ?? undefined,
    includeMuted,
  })

  // Sort: non-zero count first, then by severity (HIGH > MEDIUM > LOW), then by count desc.
  const sevRank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  results.sort((a, b) => {
    const aHasIssue = a.count > 0 ? 0 : 1
    const bHasIssue = b.count > 0 ? 0 : 1
    if (aHasIssue !== bHasIssue) return aHasIssue - bHasIssue
    const sv = sevRank[a.severity] - sevRank[b.severity]
    if (sv !== 0) return sv
    return b.count - a.count
  })

  return ok({ results })
}

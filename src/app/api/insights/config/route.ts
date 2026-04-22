import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { ok, forbidden, unauthorized, badRequest, internalServerError } from "@/lib/api/response"
import { listInsights } from "@/lib/insights/registry"
import { loadInsightConfigMap, upsertInsightConfig } from "@/lib/insights/config"
import { resolveDashboardRole } from "@/lib/dashboard/role"
import type { InsightSeverity } from "@/lib/insights/types"

function canManage(role: ReturnType<typeof resolveDashboardRole>): boolean {
  return role === "SUPER_ADMIN"
}

// Make sure every insight is registered before reading it.
async function ensureRegistered() {
  await import("@/lib/insights/items")
}

export async function GET() {
  const session = await auth()
  if (!session) return unauthorized()
  const role = resolveDashboardRole(session)
  if (!canManage(role)) return forbidden("Only Super Admins can view insight configuration.")

  await ensureRegistered()
  const insights = listInsights()
  const configs = await loadInsightConfigMap()

  const data = insights.map((i) => {
    const cfg = configs.get(i.key)
    return {
      key: i.key,
      title: i.title,
      description: i.description,
      category: i.category,
      defaultSeverity: i.defaultSeverity,
      defaultThresholds: i.defaultThresholds ?? {},
      thresholdDocs: i.thresholdDocs ?? {},
      thresholds: cfg?.thresholds ?? {},
      muted: cfg?.muted ?? false,
      mutedUntil: cfg?.mutedUntil?.toISOString() ?? null,
      mutedReason: cfg?.mutedReason ?? null,
      severityOverride: cfg?.severityOverride ?? null,
    }
  })
  return ok({ insights: data })
}

export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session) return unauthorized()
  const role = resolveDashboardRole(session)
  if (!canManage(role)) return forbidden("Only Super Admins can modify insight configuration.")

  let body: {
    key?: string
    thresholds?: Record<string, number | string | boolean>
    muted?: boolean
    mutedDays?: number | null
    mutedReason?: string | null
    severityOverride?: InsightSeverity | null
  }
  try {
    body = await request.json()
  } catch {
    return badRequest("Invalid JSON body.")
  }

  if (!body.key || typeof body.key !== "string") return badRequest("Missing or invalid `key`.")

  await ensureRegistered()
  const insights = listInsights()
  if (!insights.some((i) => i.key === body.key)) return badRequest(`Unknown insight key: ${body.key}`)

  let mutedUntil: Date | null | undefined = undefined
  if (body.muted === false) {
    mutedUntil = null
  } else if (body.muted === true) {
    if (body.mutedDays && body.mutedDays > 0) {
      mutedUntil = new Date(Date.now() + body.mutedDays * 86_400_000)
    } else {
      mutedUntil = null
    }
  }

  try {
    await upsertInsightConfig({
      key: body.key,
      thresholds: body.thresholds,
      muted: body.muted,
      mutedUntil,
      mutedReason: body.mutedReason ?? null,
      severityOverride: body.severityOverride,
      updatedById: (session.user as { id?: string } | undefined)?.id ?? null,
    })
  } catch (err) {
    console.error("[insights] config PATCH failed:", err)
    return internalServerError("Failed to save insight configuration.")
  }

  return ok({ key: body.key })
}

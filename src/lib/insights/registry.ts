import { prisma } from "@/lib/db"
import type { Session } from "next-auth"
import { deriveManagerScope } from "@/lib/access/scope"
import type { Insight, InsightComputeContext, InsightResult } from "./types"
import { loadInsightConfigMap, isMutedNow } from "./config"

const REGISTRY = new Map<string, Insight>()

export function registerInsight(insight: Insight): void {
  if (REGISTRY.has(insight.key)) {
    throw new Error(`Insight key "${insight.key}" is already registered`)
  }
  REGISTRY.set(insight.key, insight)
}

export function listInsights(): Insight[] {
  return Array.from(REGISTRY.values())
}

export function getInsight(key: string): Insight | undefined {
  return REGISTRY.get(key)
}

type RunOpts = {
  /** When true, muted insights are still computed (for the settings UI preview). */
  includeMuted?: boolean
  /** Restrict to a category. */
  category?: Insight["category"]
  /** Restrict to specific keys. */
  keys?: string[]
}

export async function runAllInsights(
  session: Session | null,
  opts: RunOpts = {}
): Promise<InsightResult[]> {
  // Ensure all insight modules have been imported and self-registered.
  await import("./items")

  const scope = deriveManagerScope(session)
  const configMap = await loadInsightConfigMap()
  const now = new Date()

  let insights = listInsights()
  if (opts.category) insights = insights.filter((i) => i.category === opts.category)
  if (opts.keys) insights = insights.filter((i) => opts.keys!.includes(i.key))

  const tasks = insights.map(async (insight): Promise<InsightResult> => {
    const cfg = configMap.get(insight.key)
    const muted = isMutedNow(cfg, now)
    if (muted && !opts.includeMuted) {
      return {
        key: insight.key,
        title: insight.title,
        description: insight.description,
        category: insight.category,
        severity: cfg?.severityOverride ?? insight.defaultSeverity,
        count: 0,
        summary: "Muted",
        muted: true,
        mutedUntil: cfg?.mutedUntil ?? null,
        mutedReason: cfg?.mutedReason ?? null,
        durationMs: 0,
      }
    }

    const thresholds = { ...(insight.defaultThresholds ?? {}), ...(cfg?.thresholds ?? {}) }
    const ctx: InsightComputeContext = { now, scope, thresholds, prisma }

    const started = Date.now()
    try {
      const raw = await insight.compute(ctx)
      return {
        ...raw,
        key: insight.key,
        title: insight.title,
        description: insight.description,
        category: insight.category,
        severity: raw.severity ?? cfg?.severityOverride ?? insight.defaultSeverity,
        muted,
        mutedUntil: cfg?.mutedUntil ?? null,
        mutedReason: cfg?.mutedReason ?? null,
        durationMs: Date.now() - started,
      }
    } catch (err) {
      console.error(`[insights] "${insight.key}" failed:`, err)
      return {
        key: insight.key,
        title: insight.title,
        description: insight.description,
        category: insight.category,
        severity: cfg?.severityOverride ?? insight.defaultSeverity,
        count: 0,
        summary: "Failed to compute",
        error: err instanceof Error ? err.message : String(err),
        muted,
        mutedUntil: cfg?.mutedUntil ?? null,
        mutedReason: cfg?.mutedReason ?? null,
        durationMs: Date.now() - started,
      }
    }
  })

  return Promise.all(tasks)
}

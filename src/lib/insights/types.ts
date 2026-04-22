import type { PrismaClient } from "@prisma/client"
import type { ManagerScope } from "@/lib/access/scope"

export type InsightCategory = "EFFICIENCY" | "ANOMALY"
export type InsightSeverity = "HIGH" | "MEDIUM" | "LOW"

export type InsightDrillItem = {
  id: string
  label: string
  sub?: string | null
  href?: string | null
  amount?: number | null
}

export type InsightComputeContext = {
  now: Date
  scope: ManagerScope | null
  /** Merged thresholds: defaults overridden by per-insight InsightConfig */
  thresholds: Record<string, number | string | boolean>
  prisma: PrismaClient
}

/** Result shape an insight must return. */
export type InsightComputeResult = {
  /** Count of affected records. 0 = nothing wrong. */
  count: number
  /** Optional rupee-impact when quantifiable. */
  amount?: number
  /** Short one-line summary (rendered as the headline). */
  summary: string
  /** Optional deep-link to a filtered list view. */
  drillUrl?: string
  /** Optional top-5 preview of offending records. */
  items?: InsightDrillItem[]
  /** Override severity based on actual magnitude (e.g., HIGH when count > 50). */
  severity?: InsightSeverity
}

export type Insight = {
  /** Stable kebab-case key. Never rename once published — InsightConfig lookups depend on it. */
  key: string
  title: string
  description: string
  category: InsightCategory
  defaultSeverity: InsightSeverity
  /** Named threshold defaults. Config table overrides these. */
  defaultThresholds?: Record<string, number | string | boolean>
  /** Documentation shown on the settings page (what each threshold means). */
  thresholdDocs?: Record<string, string>
  compute: (ctx: InsightComputeContext) => Promise<InsightComputeResult>
}

export type InsightResult = InsightComputeResult & {
  key: string
  title: string
  description: string
  category: InsightCategory
  severity: InsightSeverity
  muted: boolean
  mutedUntil: Date | null
  mutedReason: string | null
  /** If the compute call threw, the message is captured here (count = 0). */
  error?: string
  /** Milliseconds the compute took — useful for tuning slow insights. */
  durationMs: number
}

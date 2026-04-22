import { prisma } from "@/lib/db"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import type { InsightSeverity } from "./types"

export type InsightConfigRow = {
  key: string
  thresholds: Record<string, number | string | boolean>
  muted: boolean
  mutedUntil: Date | null
  mutedReason: string | null
  severityOverride: InsightSeverity | null
}

export async function loadInsightConfigMap(): Promise<Map<string, InsightConfigRow>> {
  try {
    const rows = await prisma.insightConfig.findMany()
    const map = new Map<string, InsightConfigRow>()
    for (const r of rows) {
      map.set(r.key, {
        key: r.key,
        thresholds: (r.thresholds as Record<string, number | string | boolean>) ?? {},
        muted: r.muted,
        mutedUntil: r.mutedUntil,
        mutedReason: r.mutedReason,
        severityOverride: (r.severityOverride as InsightSeverity | null) ?? null,
      })
    }
    return map
  } catch (err) {
    if (!isPrismaMissingSchemaError(err)) {
      console.error("[insights] Failed to load config:", err)
    }
    return new Map()
  }
}

export async function upsertInsightConfig(input: {
  key: string
  thresholds?: Record<string, number | string | boolean>
  muted?: boolean
  mutedUntil?: Date | null
  mutedReason?: string | null
  severityOverride?: InsightSeverity | null
  updatedById?: string | null
}): Promise<void> {
  const { key, updatedById, ...rest } = input
  await prisma.insightConfig.upsert({
    where: { key },
    create: {
      key,
      thresholds: rest.thresholds ?? {},
      muted: rest.muted ?? false,
      mutedUntil: rest.mutedUntil ?? null,
      mutedReason: rest.mutedReason ?? null,
      severityOverride: rest.severityOverride ?? null,
      updatedById: updatedById ?? null,
    },
    update: {
      ...(rest.thresholds !== undefined && { thresholds: rest.thresholds }),
      ...(rest.muted !== undefined && { muted: rest.muted }),
      ...(rest.mutedUntil !== undefined && { mutedUntil: rest.mutedUntil }),
      ...(rest.mutedReason !== undefined && { mutedReason: rest.mutedReason }),
      ...(rest.severityOverride !== undefined && { severityOverride: rest.severityOverride }),
      updatedById: updatedById ?? null,
    },
  })
}

export function isMutedNow(row: InsightConfigRow | undefined, now: Date): boolean {
  if (!row || !row.muted) return false
  if (row.mutedUntil && row.mutedUntil < now) return false
  return true
}

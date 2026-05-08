/**
 * Composable validation primitives used inside bulk-import definitions.
 *
 * The zod schema on a definition handles required / format / length /
 * enum, but cross-row and DB-aware checks live here so they can be
 * declared once and re-applied across imports.
 */

import { z } from "zod"

import type { ConditionalRule, DuplicateRule, ReferenceResolver } from "./types"

/** Standard CNIC regex used elsewhere — re-exported for definition use. */
export const CNIC_REGEX = /^\d{5}-\d{7}-\d$/
/** Pakistani phone format used in the rest of the app. */
export const PHONE_REGEX = /^\+92-\d{3}-\d{7}$/

/** ISO date `YYYY-MM-DD` (also accepts the same coerced from Excel cells). */
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/** Zod helper for trimmed required string fields. */
export const requiredString = (label: string, max = 200) =>
  z
    .string({ message: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)

/** Zod helper for optional trimmed string fields. */
export const optionalString = (max = 200) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().max(max).optional().or(z.literal("")),
  )

/** Zod helper for non-negative integers (parses Excel numeric cells). */
export const nonNegativeInt = (label: string) =>
  z.preprocess((v) => {
    if (v == null || v === "") return undefined
    const n = typeof v === "number" ? v : Number(String(v).trim())
    return Number.isFinite(n) ? n : NaN
  }, z.number({ message: `${label} is required` }).int(`${label} must be an integer`).nonnegative(`${label} must be ≥ 0`))

/** Zod helper for a CNIC field with format check. */
export const cnicField = (label = "CNIC") =>
  requiredString(label, 15).regex(CNIC_REGEX, `${label} must be in the format XXXXX-XXXXXXX-X`)

/** Zod helper for an enum-like select with a fixed value list. */
export const enumField = <T extends [string, ...string[]]>(label: string, values: T) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.enum(values, { message: `${label} must be one of: ${values.join(", ")}` }),
  )

/** Builds a reference resolver that memoises results inside the run cache. */
export function memoizedResolver<T>(
  cacheKey: string,
  fn: ReferenceResolver<T>,
): ReferenceResolver<T> {
  return async (value, ctx) => {
    const cached = ctx.cache.get(`${cacheKey}::${value}`)
    if (cached !== undefined) return cached as T | null
    const resolved = await fn(value, ctx)
    ctx.cache.set(`${cacheKey}::${value}`, resolved)
    return resolved
  }
}

/** Builds a payload-scoped duplicate rule. */
export function payloadDuplicate(fields: string[], message?: string): DuplicateRule {
  return { fields, scope: "payload", message }
}

/** Builds a DB-existence duplicate rule. */
export function dbDuplicate(
  fields: string[],
  existsInDb: DuplicateRule["existsInDb"],
  message?: string,
): DuplicateRule {
  if (!existsInDb) {
    throw new Error("dbDuplicate requires an existsInDb implementation")
  }
  return { fields, scope: "db", existsInDb, message }
}

/** Builds a conditional rule. */
export function whenThenRequired(
  whenField: string,
  predicate: (value: string) => boolean,
  thenRequired: string[],
  message?: string,
): ConditionalRule {
  return { when: { field: whenField, predicate }, thenRequired, message }
}

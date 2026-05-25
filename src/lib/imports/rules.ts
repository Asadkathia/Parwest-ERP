/**
 * Composable validation primitives used inside bulk-import definitions.
 *
 * The zod schema on a definition handles required / format / length /
 * enum, but cross-row and DB-aware checks live here so they can be
 * declared once and re-applied across imports.
 */

import { z } from "zod"

import { CNIC_REGEX, PHONE_REGEX } from "@/lib/validation/formats"
import { isSentinel } from "./coerce"
import type { ConditionalRule, DuplicateRule, ReferenceResolver } from "./types"

/**
 * CNIC + phone formats are owned by `@/lib/validation/formats` so the
 * single-create enrollment form/route and the bulk-import definitions share
 * ONE regex each — the two enrollment paths cannot drift apart. We re-export
 * them here so existing import-definition call sites keep working without
 * reaching across modules.
 */
export { CNIC_REGEX, PHONE_REGEX }

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

/**
 * Zod helper for a required field whose value must be a *real* value — not a
 * template sentinel ("Nil", "N/A", "-", "BULK", …). A plain `requiredString`
 * would accept "Nil" (non-empty) while `coerceString` later turns it into
 * `null` at persist time → silent data loss on a column the form treats as
 * mandatory. This builder rejects sentinels up front so a required cell that
 * holds a placeholder fails validation instead of persisting empty.
 */
export const requiredImportString = (label: string, max = 200) =>
  requiredString(label, max).refine((v) => !isSentinel(v), {
    message: `${label} is required`,
  })

/**
 * Zod helper for a REQUIRED Pakistani phone-number cell. Mirrors the
 * single-create form rule (PHONE_REGEX, "+92-300-1234567"). Sentinels are
 * rejected (same reason as `requiredImportString`).
 */
export const requiredPhoneField = (label: string) =>
  requiredImportString(label, 20).regex(
    PHONE_REGEX,
    `${label} must be in the format +92-300-1234567`,
  )

/**
 * Zod helper for an OPTIONAL Pakistani phone-number cell — empty / sentinel
 * passes through, but a present value must match PHONE_REGEX. Used for the
 * optional emergency contact (parity with the single-create form, which only
 * format-checks emergency contact when supplied).
 */
export const optionalPhoneField = (label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .union([z.string(), z.number(), z.null(), z.undefined()])
      .optional()
      .refine(
        (v) => isSentinel(v) || PHONE_REGEX.test(String(v)),
        `${label} must be in the format +92-300-1234567`,
      ),
  )

/**
 * Zod helper for an OPTIONAL email cell — empty / sentinel passes through, but
 * a present value must be a valid email (parity with the single-create form,
 * which only validates email when supplied).
 */
export const optionalEmailField = (label = "Email") =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .union([z.string(), z.null(), z.undefined()])
      .optional()
      .refine(
        (v) => isSentinel(v) || z.string().email().safeParse(v).success,
        `${label} must be a valid email address`,
      ),
  )

/**
 * Zod helper for a REQUIRED non-negative money/amount cell. Accepts Excel
 * numeric cells or numeric strings; rejects empty / sentinel / non-numeric /
 * negative. Mirrors the single-create salary rule (numeric, ≥ 0).
 */
export const requiredNonNegativeAmount = (label: string) =>
  z.preprocess(
    (v) => {
      if (isSentinel(v)) return undefined
      const n = typeof v === "number" ? v : Number(String(v).trim())
      return Number.isFinite(n) ? n : NaN
    },
    z
      .number({ message: `${label} is required` })
      .nonnegative(`${label} must be ≥ 0`),
  )

/**
 * Optional non-negative amount: empty / sentinel cells are allowed (→ undefined);
 * when a value is present it must be numeric and ≥ 0.
 */
export const optionalNonNegativeAmount = (label: string) =>
  z.preprocess(
    (v) => {
      if (isSentinel(v)) return undefined
      const n = typeof v === "number" ? v : Number(String(v).trim())
      return Number.isFinite(n) ? n : NaN
    },
    z
      .number({ message: `${label} must be a number` })
      .nonnegative(`${label} must be ≥ 0`)
      .optional(),
  )

/** Zod helper for a CNIC field with format check. */
export const cnicField = (label = "CNIC") =>
  requiredString(label, 15).regex(CNIC_REGEX, `${label} must be in the format XXXXX-XXXXXXX-X`)

/**
 * Zod helper for an OPTIONAL CNIC cell — empty / sentinel passes through, but a
 * present value must match CNIC_REGEX. Used for relative + introducer CNICs:
 * optional, but must be well-formed when supplied (parity with the single-create
 * form, which masks every CNIC input to XXXXX-XXXXXXX-X).
 */
export const optionalCnicField = (label = "CNIC") =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .union([z.string(), z.number(), z.null(), z.undefined()])
      .optional()
      .refine(
        (v) => isSentinel(v) || CNIC_REGEX.test(String(v)),
        `${label} must be in the format XXXXX-XXXXXXX-X`,
      ),
  )

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

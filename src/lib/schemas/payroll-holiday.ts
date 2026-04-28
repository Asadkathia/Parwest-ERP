import { z } from "zod"

/**
 * Payroll holiday create/update schema.
 *
 * Mirrors the validation enforced by:
 *   - src/app/api/payroll/holidays/route.ts POST handler
 *     (`dateFrom` required; `valueType` if present must be one of two
 *     enum values; `appliesTo` if present must be one of three enum
 *     values; `dateTo >= dateFrom`)
 *   - The legacy "Add Holiday" submit gate in PayrollHolidaysManager,
 *     which only required `dateFrom`. All other fields default
 *     server-side (name → "Holiday", status → "active", etc.).
 *
 * IMPORTANT: this schema MUST mirror the legacy validations exactly —
 * do not tighten or loosen. Any policy change goes through the API
 * first.
 */

const VALUE_TYPES = ["FIXED_PER_DAY", "MULTIPLE_OF_RATE"] as const
const APPLIES_TO = [
  "WORKED_ONLY",
  "ALL_DEPLOYED_IN_OFFICE",
  "ALL_GUARDS_IN_OFFICE",
] as const
const STATUSES = ["active", "inactive"] as const

export const payrollHolidayUpsertSchema = z
  .object({
    // Display name. Server defaults to "Holiday" when blank, so optional here.
    name: z.string().trim().optional().or(z.literal("")),

    // Optional regional office scoping. Server treats blank as null (all).
    regionalOfficeId: z.string().trim().optional().or(z.literal("")),

    // YYYY-MM-DD from <input type="date">. Required by legacy submit gate
    // and by the API.
    dateFrom: z.string().trim().min(1, "From date is required"),

    // Optional. Server falls back to dateFrom when blank.
    dateTo: z.string().trim().optional().or(z.literal("")),

    // Default per legacy radio group; one of two enum values when set.
    valueType: z.enum(VALUE_TYPES, {
      message: "Value type is required",
    }),

    // Numeric or blank. Server stores null when blank.
    value: z
      .union([z.string().trim(), z.number()])
      .optional()
      .nullable(),

    status: z.enum(STATUSES, {
      message: "Status must be active or inactive",
    }),

    comments: z.string().trim().optional().or(z.literal("")),

    appliesTo: z.enum(APPLIES_TO, {
      message: "Applies-to is required",
    }),
  })
  .superRefine((val, ctx) => {
    // Mirror API: dateTo >= dateFrom when both present.
    if (val.dateFrom && val.dateTo) {
      const from = new Date(val.dateFrom)
      const to = new Date(val.dateTo)
      if (
        !Number.isNaN(from.getTime()) &&
        !Number.isNaN(to.getTime()) &&
        to < from
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "To date must be on or after From date",
          path: ["dateTo"],
        })
      }
    }
  })

export type PayrollHolidayUpsertInput = z.infer<
  typeof payrollHolidayUpsertSchema
>

export const PAYROLL_HOLIDAY_VALUE_TYPES = VALUE_TYPES
export const PAYROLL_HOLIDAY_APPLIES_TO = APPLIES_TO
export const PAYROLL_HOLIDAY_STATUSES = STATUSES

export const PAYROLL_HOLIDAY_VALUE_TYPE_LABELS: Record<
  (typeof VALUE_TYPES)[number],
  string
> = {
  FIXED_PER_DAY: "Fixed per day amount",
  MULTIPLE_OF_RATE: "Multiple of location Rate",
}

export const PAYROLL_HOLIDAY_APPLIES_TO_LABELS: Record<
  (typeof APPLIES_TO)[number],
  string
> = {
  WORKED_ONLY: "Only guards who worked the holiday",
  ALL_DEPLOYED_IN_OFFICE: "All guards deployed at the regional office",
  ALL_GUARDS_IN_OFFICE:
    "All guards in the regional office (regardless of deployment)",
}

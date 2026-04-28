import { z } from "zod"

/**
 * Payroll extra-hours create schema.
 *
 * Mirrors the validation enforced by:
 *   - src/app/api/payroll/extra-hours/route.ts POST handler
 *     (`guardId`, `month`, `hours`, `rate` are required; the API converts
 *     month to a first-of-month Date)
 *   - The legacy "Add Extra Hours" submit gate which required `context`,
 *     `hours`, and `rate` to be non-empty.
 *
 * IMPORTANT: this schema MUST mirror the legacy validations exactly — do
 * not tighten or loosen. Any policy change goes through the API first.
 */

export const payrollExtraHoursCreateSchema = z.object({
  // Guard is selected via autocomplete; we carry the resolved id, not the
  // typed Parwest ID. Required by the API.
  guardId: z.string().trim().min(1, "Guard is required"),

  // YYYY-MM string from a <input type="month">. The API converts this to a
  // first-of-month Date — we keep the shorter shape here.
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),

  // Legacy form required Number(hours) — validated as a positive number.
  hours: z
    .number({ message: "Hours is required" })
    .finite("Hours must be a finite number")
    .positive("Hours must be greater than zero"),

  // Legacy form required Number(rate).
  rate: z
    .number({ message: "Rate is required" })
    .finite("Rate must be a finite number")
    .positive("Rate must be greater than zero"),

  // Optional context fields — preserved for the form, not sent to the API
  // payload but needed for client/branch dropdown UX parity with legacy.
  selectClientId: z.string().trim().optional().or(z.literal("")),
  selectBranchId: z.string().trim().optional().or(z.literal("")),
})

export type PayrollExtraHoursCreateInput = z.infer<
  typeof payrollExtraHoursCreateSchema
>

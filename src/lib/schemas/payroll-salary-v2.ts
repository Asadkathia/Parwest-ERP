import { z } from "zod"

/**
 * Payroll Salary V2 filter schema.
 *
 * Mirrors the validation enforced by:
 *   - src/app/api/payroll/salary-v2/summary/route.ts GET handler
 *     (`month` is required; `regionalOfficeId`, `clientId`, `regionId` are
 *     optional URL params; scope checks happen server-side)
 *   - src/app/api/payroll/salary/route.ts POST handler ("Calculate Salary")
 *     which accepts the same filter shape and forbids `finalize`.
 *
 * The legacy PayrollSalaryV2Manager has no create/edit form — only the
 * summary filter bar. This schema captures that filter so RHF can drive it
 * the same way the canonical loans manager drives its forms.
 *
 * IMPORTANT: this schema MUST mirror the legacy validations exactly — do
 * not tighten or loosen. Any policy change goes through the API first.
 */

export const payrollSalaryV2FilterSchema = z.object({
  // YYYY-MM string from <input type="month">. Required by the summary API.
  // The API accepts both YYYY-MM and YYYY-MM-DD; the legacy client always
  // posted `${month}-01` so we keep YYYY-MM here and let the submit handler
  // append the day.
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),

  // Optional regional office filter. Empty string means "All Regions".
  regionalOfficeId: z.string().trim().optional().or(z.literal("")),

  // Optional client filter. Empty string means "All Clients".
  clientId: z.string().trim().optional().or(z.literal("")),
})

export type PayrollSalaryV2FilterInput = z.infer<
  typeof payrollSalaryV2FilterSchema
>

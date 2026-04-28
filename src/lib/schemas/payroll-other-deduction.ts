import { z } from "zod"

/**
 * Payroll other-deductions create schema.
 *
 * Mirrors the validation enforced by:
 *   - src/app/api/payroll/other-deductions/route.ts POST handler
 *     (`guardId` and `month` required; `amount` finite + non-negative)
 *   - The legacy submit gate in PayrollOtherDeductionsManager, which
 *     also required a non-empty `amount` (numeric).
 *
 * IMPORTANT: this schema MUST mirror the legacy validations exactly —
 * do not tighten or loosen. Any policy change goes through the API
 * first.
 */

export const payrollOtherDeductionCreateSchema = z.object({
  // Resolved guard id from autocomplete (not the typed Parwest ID).
  guardId: z.string().trim().min(1, "Guard is required"),

  // YYYY-MM string from <input type="month">. The API converts to a
  // first-of-month Date.
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),

  // Legacy form required Number(amount) with disabled gate when blank.
  // API rejects negative or non-finite. We allow zero per the API which
  // accepts `amount >= 0`.
  amount: z
    .number({ message: "Amount is required" })
    .finite("Amount must be a finite number")
    .nonnegative("Amount must be zero or greater"),

  // Optional dated field — the legacy form rendered it but did not send
  // it. Kept here for forward-compat / display.
  dated: z.string().trim().optional().or(z.literal("")),

  // Optional notes (server accepts string or null).
  notes: z.string().trim().optional().or(z.literal("")),
})

export type PayrollOtherDeductionCreateInput = z.infer<
  typeof payrollOtherDeductionCreateSchema
>

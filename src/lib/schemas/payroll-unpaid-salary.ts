import { z } from "zod"

/**
 * Payroll unpaid-salary status update schema.
 *
 * Mirrors the validation enforced by:
 *   - src/app/api/payroll/salary/[id]/route.ts PATCH handler (accepts
 *     `paymentStatus` and `paymentRemarks`)
 *   - The legacy submit gate in PayrollUnpaidSalariesManager, which
 *     required `selectedRow`, `newStatus`, and `remarks` non-empty.
 *
 * IMPORTANT: this schema MUST mirror the legacy validations exactly —
 * do not tighten or loosen. Any policy change goes through the API
 * first.
 */

const PAYMENT_STATUSES = ["PAID", "UNPAID"] as const

export const payrollUnpaidSalaryUpdateSchema = z.object({
  // The Payroll row id targeted by the update — populated from the
  // selected row, not user input.
  payrollId: z.string().trim().min(1, "Select a guard with an unpaid salary"),

  // Required by the legacy submit gate.
  date: z.string().trim().min(1, "Date is required"),

  // The legacy form uppercased before sending; we constrain to the same
  // two values up front.
  paymentStatus: z.enum(PAYMENT_STATUSES, {
    message: "Status is required",
  }),

  // Required by the legacy submit gate (truthy `remarks`).
  paymentRemarks: z.string().trim().min(1, "Remarks are required"),
})

export type PayrollUnpaidSalaryUpdateInput = z.infer<
  typeof payrollUnpaidSalaryUpdateSchema
>

export const PAYROLL_UNPAID_SALARY_STATUSES = PAYMENT_STATUSES

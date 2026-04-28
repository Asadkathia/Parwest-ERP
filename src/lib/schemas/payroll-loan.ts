import { z } from "zod"

/**
 * Payroll loan create schema.
 *
 * Mirrors the validation enforced by:
 *   - src/app/api/payroll/loans/route.ts POST handler
 *     (`guardId`, `month`, `amount` are required; payment fields are
 *     coerced/optional server-side)
 *   - The legacy "Add Loans" form's `canSubmit` gate in
 *     PayrollLoansClient.tsx, which also required `paymentDate`,
 *     `paymentMethod`, and `slipNumber`.
 *
 * IMPORTANT: this schema MUST mirror the legacy validations exactly — do
 * not tighten or loosen. Any policy change goes through the API first.
 */

const PAYMENT_METHODS = ["BANK", "CASH", "MOBILE"] as const

export const payrollLoanCreateSchema = z.object({
  // Guard is selected via autocomplete; we carry the resolved id, not the
  // typed Parwest ID. Required by the API.
  guardId: z.string().trim().min(1, "Guard is required"),

  // YYYY-MM string from a <input type="month">. The API converts this to a
  // first-of-month Date — we keep the shorter shape here.
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),

  // The legacy form required Number(amount) > 0.
  amount: z
    .number({ message: "Amount is required" })
    .finite("Amount must be a finite number")
    .positive("Amount must be greater than zero"),

  // YYYY-MM-DD from <input type="date">. Required by the legacy submit gate.
  paymentDate: z
    .string()
    .trim()
    .min(1, "Date of payment is required"),

  // Slip number was required by the legacy submit gate.
  slipNumber: z
    .string()
    .trim()
    .min(1, "Slip number is required"),

  // Payment method was required by the legacy submit gate.
  paymentMethod: z.enum(PAYMENT_METHODS, {
    message: "Payment method is required",
  }),

  // Optional context fields — server accepts null/empty.
  selectClientId: z.string().trim().optional().or(z.literal("")),
  selectBranchId: z.string().trim().optional().or(z.literal("")),
  supervisorUserId: z.string().trim().optional().or(z.literal("")),

  // Base64 image upload (slip photo). Optional.
  imageBase64: z.string().nullable().optional(),
})

export type PayrollLoanCreateInput = z.infer<typeof payrollLoanCreateSchema>

export const PAYROLL_LOAN_PAYMENT_METHODS = PAYMENT_METHODS

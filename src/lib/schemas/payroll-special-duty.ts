import { z } from "zod"

/**
 * Payroll special-duty create schema.
 *
 * Mirrors the validation enforced by:
 *   - src/app/api/payroll/special-duty-records/route.ts POST handler
 *     (`guardId`, `dateFrom`, `dateTo`, `hours`, `hourRate` are required;
 *     attachment, comments, client/branch are optional)
 *   - The legacy "Add Special Duty" submit gate which required `context`,
 *     `dateFrom`, `dateTo`, `hours`, and `hourRate` to be non-empty.
 *
 * IMPORTANT: this schema MUST mirror the legacy validations exactly — do
 * not tighten or loosen. Any policy change goes through the API first.
 */

export const payrollSpecialDutyCreateSchema = z.object({
  // Guard is selected via autocomplete; we carry the resolved id, not the
  // typed Parwest ID. Required by the API.
  guardId: z.string().trim().min(1, "Guard is required"),

  // YYYY-MM-DD from <input type="date">. Required.
  dateFrom: z
    .string()
    .trim()
    .min(1, "Date From is required"),

  // YYYY-MM-DD from <input type="date">. Required.
  dateTo: z
    .string()
    .trim()
    .min(1, "Date To is required"),

  // Legacy form required Number(hours).
  hours: z
    .number({ message: "Hours is required" })
    .finite("Hours must be a finite number")
    .positive("Hours must be greater than zero"),

  // Legacy form required Number(hourRate).
  hourRate: z
    .number({ message: "Hour rate is required" })
    .finite("Hour rate must be a finite number")
    .positive("Hour rate must be greater than zero"),

  // Optional comments. Legacy form labelled as required (*) but the API
  // accepts null — we keep it optional to match API behaviour.
  comments: z.string().nullable().optional(),

  // Base64 attachment (image or PDF). Optional per the API.
  attachmentBase64: z.string().nullable().optional(),

  // Optional client/branch links — server accepts null/empty.
  clientId: z.string().trim().optional().or(z.literal("")),
  branchId: z.string().trim().optional().or(z.literal("")),
})

export type PayrollSpecialDutyCreateInput = z.infer<
  typeof payrollSpecialDutyCreateSchema
>

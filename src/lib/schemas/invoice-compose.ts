/**
 * Parwest ERP — Invoice Composer zod schema
 * ─────────────────────────────────────────────────────────────────────────
 * Owner: Phase 5B (invoicing reskin — multi-step composer)
 *
 * Mirrors validation in the legacy InvoiceComposer + the API at
 * `src/app/api/invoices/route.ts` (POST). Reskin only — do NOT tighten
 * or loosen any rule. The server remains the source of truth; this
 * schema is for client-side per-step gating + nicer UX.
 *
 * Notes:
 *   - The legacy composer does not surface a "discount" field; the API
 *     also has no discount concept. The schema therefore omits it
 *     (preserving business rules per scope guard).
 *   - Tax rate is captured as a percentage string (legacy UI input) and
 *     converted to a 0..1 decimal when posting to the API. We accept the
 *     same percent input here.
 *   - Status is restricted (per legacy) to non-VOID values.
 */

import { z } from "zod"

// ─── Constants ───────────────────────────────────────────────────────────────

export const COMPOSER_LINE_KINDS = [
  "MANUAL",
  "GUARD_SALARY",
  "SPECIAL_DUTY",
] as const

export const COMPOSER_STATUS_OPTIONS = [
  "DRAFT",
  "PENDING",
  "ADVANCE_PAID",
  "PARTIAL_PAID",
  "PAID",
  "UNPAID",
  "OVERDUE",
] as const

// YYYY-MM
const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/
// YYYY-MM-DD
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

// ─── Line item sub-schema ────────────────────────────────────────────────────
// Mirrors `ComposerLineItem` from `clients/invoicing/types.ts`.
export const composerLineItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(COMPOSER_LINE_KINDS),
  refId: z.string().nullable().default(null),
  description: z.string().trim().min(1, "Description is required."),
  quantity: z
    .number({ message: "Quantity is required." })
    .finite("Quantity must be a finite number.")
    .gt(0, "Quantity must be greater than zero."),
  unitPrice: z
    .number({ message: "Unit price is required." })
    .finite("Unit price must be a finite number.")
    .gte(0, "Unit price must be >= 0."),
  rateSource: z.enum(["DEPLOYMENT", "CONTRACT", "NONE"]).optional(),
})

export type ComposerLineItemForm = z.input<typeof composerLineItemSchema>

// ─── Top-level schema ────────────────────────────────────────────────────────

export const invoiceComposeSchema = z.object({
  // Step 1 — header
  clientId: z.string().trim().min(1, "Client is required."),
  branchId: z.string().trim().optional().default(""),
  period: z
    .string()
    .min(1, "Period is required.")
    .regex(PERIOD_REGEX, "Period must be in YYYY-MM format."),

  // Step 2 — line items
  lineItems: z
    .array(composerLineItemSchema)
    .min(1, "Add at least one line item."),

  // Step 3 — totals / meta
  // taxRatePct is the user input string ("17" = 17%). Empty string is allowed
  // and mapped to "no tax" at submit time. We validate range when present.
  taxRatePct: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => {
      if (!v) return true
      const n = Number(v)
      return Number.isFinite(n) && n >= 0 && n <= 100
    }, "Tax rate must be between 0 and 100."),
  dueDate: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => !v || DATE_REGEX.test(v), "Due date must be YYYY-MM-DD."),
  status: z.enum(COMPOSER_STATUS_OPTIONS).default("DRAFT"),
  notes: z.string().trim().max(2000, "Notes are too long.").optional().default(""),
})

export type InvoiceComposeInput = z.infer<typeof invoiceComposeSchema>
export type InvoiceComposeForm = z.input<typeof invoiceComposeSchema>

// ─── Step gating ─────────────────────────────────────────────────────────────
// Field paths validated at each `goNext()` call.
export const COMPOSE_STEP_FIELDS: ReadonlyArray<ReadonlyArray<keyof InvoiceComposeForm>> = [
  // Step 1: client / period (branch is optional)
  ["clientId", "period"],
  // Step 2: line items
  ["lineItems"],
  // Step 3: tax / due / status / notes (all optional shape but ranges enforced)
  ["taxRatePct", "dueDate", "status", "notes"],
] as const

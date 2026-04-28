/**
 * Parwest ERP — Invoice Payment zod schema
 * ─────────────────────────────────────────────────────────────────────────
 * Owner: Phase 5B (invoicing reskin — Record Payment form)
 *
 * Mirrors validation in the legacy InvoiceDetailModal payment form and the
 * API at `src/app/api/invoices/[id]/payments/route.ts`.
 *
 * Server enforces additional rules (cap by outstanding, void check, scope);
 * the client schema only validates the inputs the user provides.
 */

import { z } from "zod"

export const PAYMENT_METHODS = ["CASH", "BANK", "MOBILE", "OTHER"] as const

export const invoicePaymentSchema = z.object({
  amount: z
    .number({ message: "Amount is required." })
    .finite("Amount must be a finite number.")
    .positive("Amount must be greater than zero."),
  method: z.enum(PAYMENT_METHODS, {
    message: "Select a payment method.",
  }),
  notes: z.string().trim().max(500, "Notes are too long.").optional().default(""),
})

export type InvoicePaymentInput = z.infer<typeof invoicePaymentSchema>
export type InvoicePaymentForm = z.input<typeof invoicePaymentSchema>

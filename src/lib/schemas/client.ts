/**
 * Parwest ERP — Client zod schema
 * ─────────────────────────────────────────────────────────────────────────
 * Owner: Phase 4B (clients module reskin)
 *
 * Mirrors the validation rules in:
 *  - `src/app/(dashboard)/clients/new/form.tsx` (legacy enrollment form)
 *  - `src/app/(dashboard)/clients/[id]/edit/form.tsx` (legacy edit form)
 *  - `src/app/api/clients/route.ts` POST handler (server-side)
 *  - `src/app/api/clients/[id]/route.ts` PUT handler
 *
 * Reskin only — do NOT tighten or loosen any rule. The server remains the
 * source of truth; this schema is intended for client-side gating + nicer
 * UX in any future RHF-based client forms. The legacy enrollment form
 * (1100+ lines, multi-step with Leaflet picker, OCR, attachments, etc.)
 * is not migrated to RHF in Phase 4B — it is preserved as-is per the
 * Phase 3b precedent (shell + first tab canonical, others legacy).
 */

import { z } from "zod"
import { CNIC_REGEX, PHONE_REGEX } from "@/lib/validation/formats"

// ─── Core client schema ──────────────────────────────────────────────────────
// Mirrors the required fields enforced by the legacy form + API contract:
//   name (required), type (required), email (required in legacy form),
//   contactPerson (required), at least one valid phone, headOfficeAddress.
// Optional fields permit empty string to match HTML form submission.
export const clientSchema = z.object({
    // ── Identity ─────────────────────────────────────────────────────────────
    name: z.string().trim().min(1, "Client name is required."),
    type: z.string().trim().min(1, "Client type is required."),
    email: z
        .string()
        .trim()
        .min(1, "Client email is required.")
        .email("Enter a valid email address."),
    isBranchless: z.boolean().default(true),
    enrollmentDate: z
        .string()
        .trim()
        .min(1, "Enrollment date is required."),

    // ── Contact ──────────────────────────────────────────────────────────────
    contactPerson: z.string().trim().min(1, "Contact person is required."),
    contactPersonDesignation: z.string().trim().optional().default(""),
    // Primary contact number — must match Pakistan phone format.
    contactNumber: z
        .string()
        .trim()
        .min(1, "Primary contact number is required.")
        .regex(PHONE_REGEX, "Contact number must be in format +92-XXX-XXXXXXX."),
    // Additional contact numbers — same format rule when present.
    contactNumbers: z
        .array(
            z
                .string()
                .trim()
                .regex(
                    PHONE_REGEX,
                    "Contact number must be in format +92-XXX-XXXXXXX.",
                ),
        )
        .optional()
        .default([]),
    clientLocation: z.string().trim().optional().default(""),
    clientPostalCode: z.string().trim().optional().default(""),
    headOfficeAddress: z
        .string()
        .trim()
        .min(1, "Head office address is required."),

    // ── Introducer / referral (all optional) ────────────────────────────────
    introducerName: z.string().trim().optional().default(""),
    introducerContactNumber: z
        .string()
        .trim()
        .optional()
        .default("")
        .refine(
            (v) => !v || v === "+92-" || PHONE_REGEX.test(v),
            "Introducer contact must be in format +92-XXX-XXXXXXX.",
        ),
    introducerAddress: z.string().trim().optional().default(""),
    introducerCnicNumber: z
        .string()
        .trim()
        .optional()
        .default("")
        .refine(
            (v) => !v || CNIC_REGEX.test(v),
            "Introducer CNIC format must be XXXXX-XXXXXXX-X.",
        ),

    // ── Operational territory ────────────────────────────────────────────────
    operationalProvinces: z.string().trim().optional().default(""),

    // ── Region & assignment ──────────────────────────────────────────────────
    regionId: z.string().trim().optional().default(""),
    regionalOfficeId: z.string().trim().optional().default(""),
    assignedManagerId: z.string().trim().optional().default(""),
    assignedSupervisorId: z.string().trim().optional().default(""),

    // ── Tax info ─────────────────────────────────────────────────────────────
    ntn: z.string().trim().optional().default(""),
    strn: z.string().trim().optional().default(""),

    // ── Status (settings/status toggle) ──────────────────────────────────────
    status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),

    // ── Contract dates + meta (cross-field validation) ──────────────────────
    contractStart: z.string().trim().optional().default(""),
    contractEnd: z.string().trim().optional().default(""),
    contractRateStart: z.string().trim().optional().default(""),
    contractRateEnd: z.string().trim().optional().default(""),
    contractPrice: z.string().trim().optional().default(""),
    contractAdditionalDayGuards: z.string().trim().optional().default(""),
    contractAdditionalNightGuards: z.string().trim().optional().default(""),

    // ── Attachments (data URLs handled out-of-band) ─────────────────────────
    contractUrl: z.string().optional().default(""),
}).superRefine((data, ctx) => {
    // Mirrors the legacy form's post-submit cross-field check:
    // contract end must be after contract start (when both present).
    if (data.contractStart && data.contractEnd) {
        const start = new Date(data.contractStart).getTime()
        const end = new Date(data.contractEnd).getTime()
        if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["contractEnd"],
                message: "Contract end date must be after the contract start date.",
            })
        }
    }
})

export type ClientInput = z.infer<typeof clientSchema>
export type ClientForm = z.input<typeof clientSchema>

// ─── Aliases used by Phase 4B follow-up RHF forms ────────────────────────────
// Both create + edit share the same field set. The create form imports
// `clientCreateSchema`; the edit form imports `clientEditSchema`.
// Edit-mode keeps `email` optional/empty-tolerant to match the legacy edit
// form which doesn't require email re-entry.
export const clientCreateSchema = clientSchema
export type ClientCreateForm = z.input<typeof clientCreateSchema>

export const clientEditSchema = z.object({
    name: z.string().trim().min(1, "Client name is required."),
    type: z.string().trim().min(1, "Client type is required."),
    email: z
        .string()
        .trim()
        .optional()
        .default("")
        .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address."),
    isBranchless: z.boolean().default(true),
    enrollmentDate: z.string().trim().optional().default(""),
    status: z.enum(["ACTIVE", "INACTIVE", "BLACKLISTED"]).optional().default("ACTIVE"),

    contactPerson: z.string().trim().optional().default(""),
    contactPersonDesignation: z.string().trim().optional().default(""),
    contactNumbers: z
        .array(
            z
                .string()
                .trim()
                .regex(
                    PHONE_REGEX,
                    "Contact number must be in format +92-XXX-XXXXXXX.",
                ),
        )
        .optional()
        .default([]),
    clientLocation: z.string().trim().optional().default(""),
    clientPostalCode: z.string().trim().optional().default(""),
    headOfficeAddress: z.string().trim().optional().default(""),

    introducerName: z.string().trim().optional().default(""),
    introducerContactNumber: z
        .string()
        .trim()
        .optional()
        .default("")
        .refine(
            (v) => !v || v === "+92-" || PHONE_REGEX.test(v),
            "Introducer contact must be in format +92-XXX-XXXXXXX.",
        ),
    introducerAddress: z.string().trim().optional().default(""),
    introducerCnicNumber: z
        .string()
        .trim()
        .optional()
        .default("")
        .refine(
            (v) => !v || CNIC_REGEX.test(v),
            "Introducer CNIC format must be XXXXX-XXXXXXX-X.",
        ),

    operationalProvinces: z.string().trim().optional().default(""),

    regionId: z.string().trim().optional().default(""),
    regionalOfficeId: z.string().trim().optional().default(""),
    assignedManagerId: z.string().trim().optional().default(""),
    assignedSupervisorId: z.string().trim().optional().default(""),

    ntn: z.string().trim().optional().default(""),
    strn: z.string().trim().optional().default(""),
    logoUrl: z.string().trim().optional().default(""),
    reservePctInput: z.string().trim().optional().default(""),

    contractStart: z.string().trim().optional().default(""),
    contractEnd: z.string().trim().optional().default(""),
    contractRateStart: z.string().trim().optional().default(""),
    contractRateEnd: z.string().trim().optional().default(""),
    contractDayGuardDesignation: z.string().trim().optional().default(""),
    contractDayGuardExService: z.string().trim().optional().default(""),
    contractNightGuardDesignation: z.string().trim().optional().default(""),
    contractNightGuardExService: z.string().trim().optional().default(""),
    contractAdditionalDayGuards: z.string().trim().optional().default(""),
    contractAdditionalNightGuards: z.string().trim().optional().default(""),
    contractPrice: z.string().trim().optional().default(""),
}).superRefine((data, ctx) => {
    if (data.contractStart && data.contractEnd) {
        const start = new Date(data.contractStart).getTime()
        const end = new Date(data.contractEnd).getTime()
        if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["contractEnd"],
                message: "Contract end date must be after the contract start date.",
            })
        }
    }
    if (data.reservePctInput) {
        const pct = parseFloat(data.reservePctInput)
        if (Number.isNaN(pct) || pct < 0 || pct > 100) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["reservePctInput"],
                message: "Reserve Salary % must be between 0 and 100.",
            })
        }
    }
})

export type ClientEditForm = z.input<typeof clientEditSchema>

// ─── Status toggle schema (used by ClientStatusToggle) ───────────────────────
export const clientStatusSchema = z.object({
    status: z.enum(["ACTIVE", "INACTIVE"]),
})

export type ClientStatusInput = z.infer<typeof clientStatusSchema>

/**
 * Parwest ERP — Deployment Create zod schema
 * ─────────────────────────────────────────────────────────────────────────
 * Owner: Phase 4A (deployments reskin)
 *
 * Mirrors the existing validation rules from the legacy deploy form
 * (`src/app/(dashboard)/guards/deploy/form.tsx`) and from the API POST
 * handler (`src/app/api/deployments/route.ts`). Reskin only — do NOT
 * tighten or loosen any rule. The server remains the source of truth;
 * this schema is for client-side gating + nicer UX.
 *
 * Workflow rules with logic too complex to mirror cleanly client-side
 * (branch capacity counts, contract date ranges, supervisor existence,
 * inventory minimum) remain server-only and surface via API errors.
 */

import { z } from "zod"

export const SHIFT_TYPES = ["DAY", "NIGHT", "BOTH"] as const
export const DEPLOYMENT_TYPES = ["REGULAR", "OVERTIME"] as const
export const DEPLOYMENT_NATURES = ["PERMANENT", "TEMPORARY"] as const

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export const deploymentCreateSchema = z
  .object({
    // Required identifiers (API: guardId, clientId, regionalOfficeId).
    guardId: z.string().trim().min(1, "Guard is required."),
    clientId: z.string().trim().min(1, "Client is required."),
    branchId: z.string().trim().optional().nullable().default(null),
    regionalOfficeId: z
      .string()
      .trim()
      .min(1, "Regional Office is required."),

    // Required deployment date — must not be in the future (API enforces too).
    deploymentDate: z
      .string()
      .trim()
      .min(1, "Deployment date is required.")
      .refine((v) => {
        const d = new Date(v)
        if (Number.isNaN(d.getTime())) return false
        const today = new Date()
        today.setHours(23, 59, 59, 999)
        return d.getTime() <= today.getTime()
      }, "Deployment date cannot be in the future."),

    // Default to "Security Guard" (matches API fallback).
    designation: z
      .string()
      .trim()
      .min(1, "Designation is required.")
      .default("Security Guard"),

    shiftType: z.enum(SHIFT_TYPES).default("DAY"),

    // Shift windows — optional strings, but if present must be HH:MM.
    dayShiftStart: z
      .string()
      .trim()
      .optional()
      .default("")
      .refine((v) => !v || HHMM_RE.test(v), "Use HH:MM."),
    dayShiftEnd: z
      .string()
      .trim()
      .optional()
      .default("")
      .refine((v) => !v || HHMM_RE.test(v), "Use HH:MM."),
    nightShiftStart: z
      .string()
      .trim()
      .optional()
      .default("")
      .refine((v) => !v || HHMM_RE.test(v), "Use HH:MM."),
    nightShiftEnd: z
      .string()
      .trim()
      .optional()
      .default("")
      .refine((v) => !v || HHMM_RE.test(v), "Use HH:MM."),

    deploymentType: z.enum(DEPLOYMENT_TYPES).default("REGULAR"),
    deploymentNature: z.enum(DEPLOYMENT_NATURES).default("PERMANENT"),
    isExtraGuard: z.boolean().default(false),

    // Optional metadata.
    guardType: z.string().trim().optional().default(""),
    notes: z.string().trim().optional().default(""),
    comment: z.string().trim().optional().default(""),

    // Optional numeric fields — accept empty strings as "null".
    rate: z
      .union([z.string(), z.number(), z.null()])
      .optional()
      .nullable(),
    salary: z
      .union([z.string(), z.number(), z.null()])
      .optional()
      .nullable(),
    overtime: z
      .union([z.string(), z.number(), z.null()])
      .optional()
      .nullable(),
    extraHours: z
      .union([z.string(), z.number(), z.null()])
      .optional()
      .nullable(),
    postAllowance: z
      .union([z.string(), z.number(), z.null()])
      .optional()
      .nullable(),
  })
  .superRefine((val, ctx) => {
    // Extra-guard implies temporary nature (mirrors the form's hard rule).
    if (val.isExtraGuard && val.deploymentNature !== "TEMPORARY") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deploymentNature"],
        message: "Extra-guard deployments must be Temporary.",
      })
    }
  })

export type DeploymentCreateInput = z.infer<typeof deploymentCreateSchema>
export type DeploymentCreateForm = z.input<typeof deploymentCreateSchema>

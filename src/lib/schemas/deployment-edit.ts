/**
 * Parwest ERP — Deployment Edit (Change) zod schema
 * ─────────────────────────────────────────────────────────────────────────
 * Owner: Phase 4A (deployments reskin — edit form)
 *
 * Mirrors the validation in the legacy "change deployment" flow
 * (`src/app/(dashboard)/deployments/[id]/edit/form.tsx`) and the API
 * handler at `src/app/api/deployments/[id]/change/route.ts`. Reskin only —
 * do NOT tighten or loosen any rule. The server stays the source of truth.
 *
 * Workflow rules with logic too complex to mirror cleanly client-side
 * (branch capacity counts, contract date ranges, supervisor existence,
 * `requireBranchContract`, `requireClientHasBranches`) remain server-only
 * and surface via API errors.
 */

import { z } from "zod"
import {
  SHIFT_TYPES,
  DEPLOYMENT_TYPES,
  DEPLOYMENT_NATURES,
} from "@/lib/schemas/deployment-create"

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export const CHANGE_REASON_CODES = [
  "CLIENT_TRANSFER",
  "BRANCH_TRANSFER",
  "SHIFT_CHANGE",
  "ROLE_CHANGE",
  "OPERATIONAL",
  "OTHER",
] as const

export const deploymentEditSchema = z
  .object({
    clientId: z.string().trim().min(1, "Client is required."),
    branchId: z.string().trim().optional().nullable().default(null),
    regionalOfficeId: z
      .string()
      .trim()
      .min(1, "Regional Office is required."),

    shiftType: z.enum(SHIFT_TYPES).default("DAY"),
    designation: z
      .string()
      .trim()
      .min(1, "Designation is required.")
      .default("Guard"),
    deploymentType: z.enum(DEPLOYMENT_TYPES).default("REGULAR"),
    deploymentNature: z.enum(DEPLOYMENT_NATURES).default("PERMANENT"),
    isExtraGuard: z.boolean().default(false),

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

    // Effective date — required, not in the future (mirrors API).
    effectiveDate: z
      .string()
      .trim()
      .min(1, "Effective date is required.")
      .refine((v) => {
        const d = new Date(v)
        if (Number.isNaN(d.getTime())) return false
        const today = new Date()
        today.setHours(23, 59, 59, 999)
        return d.getTime() <= today.getTime()
      }, "Deployment date cannot be in the future."),

    changeReason: z.enum(CHANGE_REASON_CODES, {
      message: "Select a reason for the change.",
    }),

    notes: z.string().trim().optional().default(""),
  })
  .superRefine((val, ctx) => {
    const isExtra = val.isExtraGuard || val.deploymentType === "EXTRA"
    if (isExtra && val.deploymentNature !== "TEMPORARY") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deploymentNature"],
        message: "Extra-guard deployments must be Temporary.",
      })
    }
  })

export type DeploymentEditInput = z.infer<typeof deploymentEditSchema>
export type DeploymentEditForm = z.input<typeof deploymentEditSchema>

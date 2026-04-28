/**
 * Parwest ERP — Deployment End (Revoke) zod schema
 * ─────────────────────────────────────────────────────────────────────────
 * Owner: Phase 4A (deployments reskin — end form)
 *
 * Mirrors validation in the legacy revoke form and the API at
 * `src/app/api/deployments/[id]/end/route.ts`.
 *
 * Workflow rules surfaced here:
 *   - `deployments.requireEndDate`                       → endDate required
 *   - `deployments.disallowEndDateBeforeDeploymentDate`  → endDate >= deploymentDate
 *   - `deployments.disallowFutureEndDate`                → endDate <= today
 *
 * The deploymentDate floor is dynamic per-record, so the schema is built
 * via a factory that takes the deployment's start date.
 */

import { z } from "zod"

export const REVOKE_REASON_CODES = [
  "CLIENT_REQUEST",
  "GUARD_REQUEST",
  "TRANSFER",
  "CONTRACT_END",
  "MISCONDUCT",
  "ABSENT_WITHOUT_LEAVE",
  "MEDICAL",
  "TERMINATED",
  "OTHER",
] as const

function startOfDay(value: string | Date): Date | null {
  const d = value instanceof Date ? new Date(value) : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  d.setHours(0, 0, 0, 0)
  return d
}

export function makeDeploymentEndSchema(deploymentDate: Date | string) {
  const floor = startOfDay(deploymentDate)

  return z.object({
    // requireEndDate
    endDate: z
      .string()
      .trim()
      .min(1, "End date is required.")
      .refine((v) => {
        const d = startOfDay(v)
        return d !== null
      }, "Invalid end date.")
      // disallowFutureEndDate
      .refine((v) => {
        const d = startOfDay(v)
        const today = startOfDay(new Date())
        if (!d || !today) return false
        return d.getTime() <= today.getTime()
      }, "End date cannot be in the future.")
      // disallowEndDateBeforeDeploymentDate
      .refine((v) => {
        const d = startOfDay(v)
        if (!d || !floor) return true
        return d.getTime() >= floor.getTime()
      }, "End date cannot be before deployment date."),

    reasonCode: z.enum(REVOKE_REASON_CODES, {
      message: "Select a reason for revocation.",
    }),

    notes: z.string().trim().optional().default(""),
  })
}

export type DeploymentEndInput = z.infer<ReturnType<typeof makeDeploymentEndSchema>>
export type DeploymentEndForm = z.input<ReturnType<typeof makeDeploymentEndSchema>>

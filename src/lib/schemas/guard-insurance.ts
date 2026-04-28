import { z } from "zod"

/**
 * Schemas for the Guards → Insurance tab.
 *
 * Mirrors the bodies accepted by:
 *   POST   src/app/api/guards/[id]/insurance/route.ts
 *   PATCH  src/app/api/guards/[id]/insurance/[insuranceId]/route.ts
 *
 * The server is the source of truth for validation — these client schemas
 * only validate user input shape and provide friendly messages.
 *
 * Data shape note: a "guard insurance" is an assignment of an existing
 * ClientInsurance policy to a guard, plus an optional Health ID. There is
 * no provider/policyNumber/coverage/premium on this row — those fields live
 * on ClientInsurance itself, which is managed in the Clients module.
 */

export const GUARD_INSURANCE_STATUS_VALUES = ["ACTIVE", "INACTIVE"] as const
export type GuardInsuranceStatusValue = (typeof GUARD_INSURANCE_STATUS_VALUES)[number]

export const GUARD_INSURANCE_STATUS_LABELS: Record<GuardInsuranceStatusValue, string> = {
    ACTIVE: "Active",
    INACTIVE: "Inactive",
}

/** Create form — assign a ClientInsurance to the guard with an optional Health ID. */
export const guardInsuranceCreateSchema = z.object({
    clientInsuranceId: z
        .string()
        .trim()
        .min(1, "Please select a client insurance"),
    healthId: z
        .string()
        .trim()
        .max(120, "Health ID is too long")
        .optional()
        .or(z.literal("")),
})

export type GuardInsuranceCreateInput = z.infer<typeof guardInsuranceCreateSchema>

/** Edit form — adjust Health ID and/or status on an existing assignment. */
export const guardInsuranceEditSchema = z.object({
    healthId: z
        .string()
        .trim()
        .max(120, "Health ID is too long")
        .optional()
        .or(z.literal("")),
    status: z.enum(GUARD_INSURANCE_STATUS_VALUES, {
        message: "Status is required",
    }),
})

export type GuardInsuranceEditInput = z.infer<typeof guardInsuranceEditSchema>

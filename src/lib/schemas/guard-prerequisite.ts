import { z } from "zod"

/**
 * Schema for the Verification tab's "Update verification status" dialog.
 *
 * Mirrors the PATCH body accepted by:
 *   src/app/api/guards/[id]/prerequisites/[prereqId]/route.ts
 *
 * The server is the source of truth for which `verificationStatus` values are
 * allowed and how they map to the simplified `status` field — this client
 * schema only validates user input shape.
 */
export const VERIFICATION_STATUS_VALUES = [
    "REQUEST_SUBMITTED",
    "REQUEST_NOT_SUBMITTED",
    "VERIFIED",
    "NON_VERIFIED",
    "LETTER_ISSUED",
    "LETTER_NOT_ISSUED",
    "FEEDBACK_RECEIVED",
    "FEEDBACK_PENDING",
] as const

export type VerificationStatusValue = (typeof VERIFICATION_STATUS_VALUES)[number]

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatusValue, string> = {
    REQUEST_SUBMITTED: "Request Submitted",
    REQUEST_NOT_SUBMITTED: "Request Not Submitted",
    VERIFIED: "Verified",
    NON_VERIFIED: "Non Verified",
    LETTER_ISSUED: "Letter Issued",
    LETTER_NOT_ISSUED: "Letter Not Issued",
    FEEDBACK_RECEIVED: "Feedback Received",
    FEEDBACK_PENDING: "Feedback Pending",
}

export const guardPrerequisiteVerifySchema = z.object({
    verificationStatus: z.enum(VERIFICATION_STATUS_VALUES, {
        message: "Verification status is required",
    }),
    expiryDate: z
        .string()
        .trim()
        .optional()
        .or(z.literal("")),
    comments: z
        .string()
        .trim()
        .max(2000, "Comments are too long")
        .optional()
        .or(z.literal("")),
})

export type GuardPrerequisiteVerifyInput = z.infer<typeof guardPrerequisiteVerifySchema>

/** Maps the verbose verificationStatus to the simplified `status` enum. */
export function deriveSimpleStatus(
    verificationStatus: VerificationStatusValue
): "PENDING" | "VERIFIED" | "REJECTED" {
    if (verificationStatus === "VERIFIED") return "VERIFIED"
    if (verificationStatus === "NON_VERIFIED") return "REJECTED"
    return "PENDING"
}

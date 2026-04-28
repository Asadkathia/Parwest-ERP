import { z } from "zod"
import {
    CNIC_REGEX,
    PHONE_REGEX,
    MIN_GUARD_AGE,
    MAX_GUARD_AGE,
    calculateAgeYears,
} from "@/lib/validation/formats"

/**
 * Personal Details schema for the first tab of the guard profile.
 *
 * This mirrors the legacy field-level validations enforced in:
 *   - src/components/ui/CnicInput.tsx (CNIC format)
 *   - src/components/ui/PhoneInput.tsx (PK phone format)
 *   - src/app/api/guards/[id]/route.ts PUT handler (age 18..65, CNIC format)
 *
 * Async checks (CNIC uniqueness, blacklist) remain in CnicInput, which calls
 * /api/guards/check-cnic — this schema does not duplicate that logic.
 */
export const guardPersonalSchema = z.object({
    name: z
        .string({ message: "Full name is required" })
        .trim()
        .min(2, "Full name must be at least 2 characters")
        .max(100, "Full name is too long"),

    cnic: z
        .string({ message: "CNIC is required" })
        .trim()
        .regex(CNIC_REGEX, "Format must be XXXXX-XXXXXXX-X (13 digits)"),

    phone: z
        .string()
        .trim()
        .optional()
        .or(z.literal(""))
        .refine(
            (val) => !val || PHONE_REGEX.test(val),
            { message: "Format must be +92-300-1234567" }
        ),

    email: z
        .string()
        .trim()
        .email("Enter a valid email address")
        .or(z.literal(""))
        .optional(),

    dateOfBirth: z
        .string()
        .trim()
        .min(1, "Date of birth is required")
        .refine(
            (val) => {
                const age = calculateAgeYears(val)
                return age != null && age >= MIN_GUARD_AGE && age <= MAX_GUARD_AGE
            },
            { message: `Age must be between ${MIN_GUARD_AGE} and ${MAX_GUARD_AGE}` }
        ),

    fatherName: z.string().trim().max(100).optional().or(z.literal("")),
    motherName: z.string().trim().max(100).optional().or(z.literal("")),

    religion: z.string().trim().optional().or(z.literal("")),
    maritalStatus: z
        .enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", ""])
        .optional()
        .or(z.literal("")),
    nationality: z.string().trim().optional().or(z.literal("")),

    addressCurrent: z.string().trim().max(500).optional().or(z.literal("")),
    addressPermanent: z.string().trim().max(500).optional().or(z.literal("")),
    emergencyContact: z.string().trim().max(100).optional().or(z.literal("")),
})

export type GuardPersonalInput = z.infer<typeof guardPersonalSchema>

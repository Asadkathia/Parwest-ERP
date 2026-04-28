import { z } from "zod"
import {
    CNIC_REGEX,
    MIN_GUARD_AGE,
    MAX_GUARD_AGE,
    calculateAgeYears,
} from "@/lib/validation/formats"

/**
 * Schema for the unified guard edit form
 * (`src/app/(dashboard)/guards/[id]/edit/form.tsx`).
 *
 * Mirrors the legacy field-level validations enforced in:
 *   - src/components/ui/CnicInput.tsx (CNIC format)
 *   - src/app/api/guards/[id]/route.ts PUT handler (age 18..65, CNIC format)
 *
 * Top-level scalar fields plus the `bankAccounts` array (managed via
 * RHF `useFieldArray` in GuardAccountsEditor). Other multi-row sub-editors
 * (FamilyMembersEditor, NearestRelativesEditor, PreviousEmploymentEditor)
 * keep their own internal state and serialize to hidden inputs read via
 * FormData on submit.
 *
 * Async checks (CNIC uniqueness, blacklist) remain in CnicInput, which calls
 * /api/guards/check-cnic — this schema does not duplicate that logic.
 */

/**
 * Bank account row shape — mirrors the legacy GuardBankAccount type
 * (`src/lib/guards/bank-accounts.ts`). Field names must match exactly so the
 * existing PUT /api/guards/[id] handler keeps working unchanged.
 */
export const bankAccountSchema = z.object({
    id: z.string().trim().optional().or(z.literal("")),
    bankName: z.string().trim().min(1, "Bank name required"),
    accountTitle: z.string().trim().optional().or(z.literal("")),
    accountNumber: z.string().trim().min(1, "Account number required"),
    iban: z.string().trim().optional().or(z.literal("")),
    branchCode: z.string().trim().optional().or(z.literal("")),
    branchLocation: z.string().trim().optional().or(z.literal("")),
    accountType: z.enum(["SAVINGS", "CURRENT"]).default("SAVINGS"),
    accountStatus: z
        .enum(["ACTIVE", "PENDING", "INACTIVE", "DORMANT", "SUSPENDED"])
        .default("ACTIVE"),
    walletType: z
        .enum(["BANK", "JAZZCASH", "EASYPAISA", "NAYAPAY", "SADAPAY", "UPAISA", "OTHER"])
        .default("BANK"),
    isActive: z.boolean().default(false),
})

// Legacy editor never enforced a hard cap; cap at 5 rows to mirror UI sanity.
export const bankAccountsSchema = z.array(bankAccountSchema).max(5)
export type BankAccountInput = z.infer<typeof bankAccountSchema>
export const guardEditSchema = z.object({
    name: z
        .string({ message: "Full name is required" })
        .trim()
        .min(2, "Full name must be at least 2 characters")
        .max(100, "Full name is too long"),

    cnic: z
        .string({ message: "CNIC is required" })
        .trim()
        .regex(CNIC_REGEX, "Format must be XXXXX-XXXXXXX-X (13 digits)"),

    dateOfBirth: z
        .string()
        .trim()
        .optional()
        .or(z.literal(""))
        .refine(
            (val) => {
                if (!val) return true
                const age = calculateAgeYears(val)
                return age != null && age >= MIN_GUARD_AGE && age <= MAX_GUARD_AGE
            },
            { message: `Age must be between ${MIN_GUARD_AGE} and ${MAX_GUARD_AGE}` }
        ),

    age: z.string().trim().optional().or(z.literal("")),

    fatherName: z.string().trim().max(100).optional().or(z.literal("")),
    motherName: z.string().trim().max(100).optional().or(z.literal("")),
    religion: z.string().trim().optional().or(z.literal("")),
    maritalStatus: z.string().trim().optional().or(z.literal("")),
    education: z.string().trim().optional().or(z.literal("")),
    nationality: z.string().trim().optional().or(z.literal("")),
    nextOfKin: z.string().trim().optional().or(z.literal("")),
    profileIntroducer: z.string().trim().optional().or(z.literal("")),

    phone: z.string().trim().optional().or(z.literal("")),
    email: z
        .string()
        .trim()
        .email("Enter a valid email address")
        .or(z.literal(""))
        .optional(),
    emergencyContact: z.string().trim().max(100).optional().or(z.literal("")),
    additionalContactNumbers: z.string().trim().max(500).optional().or(z.literal("")),

    addressPermanent: z.string().trim().max(500).optional().or(z.literal("")),
    addressCurrent: z.string().trim().max(500).optional().or(z.literal("")),

    regionId: z.string().trim().optional().or(z.literal("")),
    regionalOfficeId: z.string().trim().optional().or(z.literal("")),
    joiningDate: z.string().trim().optional().or(z.literal("")),
    status: z.string().trim().optional().or(z.literal("")),
    paymentMode: z.string().trim().optional().or(z.literal("")),
    guardCategory: z.string().trim().optional().or(z.literal("")),
    supervisorId: z.string().trim().optional().or(z.literal("")),

    bankAccounts: bankAccountsSchema.default([]),
})

/**
 * Output type — what the schema produces after parsing (post-defaults applied).
 */
export type GuardEditInput = z.infer<typeof guardEditSchema>

/**
 * Input type — what the form accepts BEFORE zod applies defaults. Use this
 * with `useForm<GuardEditForm>()` so optional+default fields (e.g. bankAccounts)
 * can be omitted from `defaultValues` without TS errors.
 */
export type GuardEditForm = z.input<typeof guardEditSchema>

/**
 * Parwest ERP — Branch zod schemas
 * ─────────────────────────────────────────────────────────────────────────
 * Owner: Phase 4B follow-up (clients/branches reskin).
 *
 * Mirrors the validation rules of:
 *  - `src/app/(dashboard)/clients/[id]/branches/new/form.tsx` (create form)
 *  - `src/app/(dashboard)/clients/branches/[id]/edit/form.tsx`  (edit form)
 *  - `src/app/api/branches/route.ts` POST handler
 *  - `src/app/api/branches/[id]/route.ts` PATCH handler
 *
 * Reskin only — server is the source of truth. The schema stays tolerant
 * (most fields optional + empty-string default) to match the legacy multi-
 * section branch form, where only `name` and at least one contact phone
 * are strictly required client-side. The deeper capacity / contract
 * sections fall through to the API as-is.
 */

import { z } from "zod"
import { CNIC_REGEX, PHONE_REGEX } from "@/lib/validation/formats"

// Capacity field keys — must match Prisma `Branch` columns and the
// designation→capacity mapping used by `src/app/api/deployments/route.ts`.
export const BRANCH_CAPACITY_FIELDS = [
    "dayGuardCapacity",
    "nightGuardCapacity",
    "daySupervisorCapacity",
    "nightSupervisorCapacity",
    "cpoCapacity",
    "dayCpoCapacity",
    "nightCpoCapacity",
    "daySoCapacity",
    "nightSoCapacity",
    "dayAsoCapacity",
    "nightAsoCapacity",
    "dayLsoCapacity",
    "nightLsoCapacity",
    "dayCctvCapacity",
    "nightCctvCapacity",
    "dayReceptionistCapacity",
    "nightReceptionistCapacity",
] as const
export type BranchCapacityField = (typeof BRANCH_CAPACITY_FIELDS)[number]

// Capacity inputs are strings on the form (HTML number inputs return ""),
// then coerced to nullable non-negative integers before transmission.
const capacityFieldSchema = z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => {
        if (v === null || v === undefined || v === "") return null
        const n = typeof v === "number" ? v : Number(v)
        return Number.isFinite(n) ? n : NaN
    })
    .refine((n) => n === null || (Number.isInteger(n) && n >= 0), {
        message: "Capacity must be a non-negative whole number.",
    })

const capacityShape = BRANCH_CAPACITY_FIELDS.reduce<
    Record<BranchCapacityField, typeof capacityFieldSchema>
>((acc, key) => {
    acc[key] = capacityFieldSchema
    return acc
}, {} as Record<BranchCapacityField, typeof capacityFieldSchema>)

// ─── Edit schema (lean — mirrors the edit form fields) ──────────────────────
export const branchEditSchema = z.object({
    name: z.string().trim().min(1, "Branch name is required."),
    code: z.string().trim().optional().default(""),
    branchType: z.enum(["CONVENTIONAL", "ISLAMIC"]).optional().default("CONVENTIONAL"),
    isHeadOffice: z.boolean().optional().default(false),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),

    address: z.string().trim().optional().default(""),
    city: z.string().trim().optional().default(""),
    province: z.string().trim().optional().default(""),

    contactPerson: z.string().trim().optional().default(""),
    contactPhone: z
        .string()
        .trim()
        .optional()
        .default("")
        .refine(
            (v) => !v || v === "+92-" || PHONE_REGEX.test(v),
            "Contact phone must be in format +92-XXX-XXXXXXX.",
        ),
    contactEmail: z
        .string()
        .trim()
        .optional()
        .default("")
        .refine(
            (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
            "Enter a valid email address.",
        ),

    // Assignment (Branch.assignedManagerId / operationsManagerId are direct
    // FK columns; assignedSupervisorId is materialised through the
    // ClientSupervisorAssignment join model — see PATCH handler).
    assignedManagerId: z.string().trim().optional().default(""),
    operationsManagerId: z.string().trim().optional().default(""),
    assignedSupervisorId: z.string().trim().optional().default(""),

    ...capacityShape,
})

export type BranchEditForm = z.input<typeof branchEditSchema>
export type BranchEditFormParsed = z.output<typeof branchEditSchema>

// ─── Create schema (covers the broad legacy create form — permissive) ───────
// The legacy create form has many optional fields (capacity, contract,
// attachments, manager assignments). The server validates strictly; here we
// only enforce the same client-side rules the legacy form did:
//   - `name` required
//   - at least one valid `contactPhone`
//   - optional CNIC + single-field phones must match formats when present
export const branchCreateSchema = z.object({
    // ── Identity ─────────────────────────────────────────────────────────────
    name: z.string().trim().min(1, "Branch name is required."),
    code: z.string().trim().optional().default(""),
    branchType: z.enum(["CONVENTIONAL", "ISLAMIC"]).optional().default("CONVENTIONAL"),
    officeType: z.string().trim().optional().default(""),
    isHeadOffice: z.boolean().optional().default(false),
    isLockerBranch: z.enum(["yes", "no"]).optional().default("no"),
    enrollmentDate: z.string().trim().optional().default(""),

    // ── Location ────────────────────────────────────────────────────────────
    address: z.string().trim().optional().default(""),
    city: z.string().trim().optional().default(""),
    province: z.string().trim().optional().default(""),
    latitudeManual: z.string().trim().optional().default(""),
    longitudeManual: z.string().trim().optional().default(""),

    // ── Region & assignment ─────────────────────────────────────────────────
    regionId: z.string().trim().optional().default(""),
    regionalOfficeId: z.string().trim().optional().default(""),
    assignedManagerId: z.string().trim().optional().default(""),
    assignedSupervisorId: z.string().trim().optional().default(""),
    operationsManagerId: z.string().trim().optional().default(""),

    // ── Contact person (CNIC + multi-phone validated outside zod) ───────────
    contactPerson: z.string().trim().optional().default(""),
    contactPersonDesignation: z.string().trim().optional().default(""),
    contactPersonCnic: z
        .string()
        .trim()
        .optional()
        .default("")
        .refine(
            (v) => !v || CNIC_REGEX.test(v),
            "Contact Person CNIC format is invalid. Expected XXXXX-XXXXXXX-X.",
        ),
    contactEmail: z
        .string()
        .trim()
        .optional()
        .default("")
        .refine(
            (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
            "Enter a valid email address.",
        ),

    // ── Branch / Operations / Supervisor managers ───────────────────────────
    branchManagerName: z.string().trim().optional().default(""),
    branchManagerContact: z
        .string()
        .trim()
        .optional()
        .default("")
        .refine(
            (v) => !v || v === "+92-" || PHONE_REGEX.test(v),
            "Branch Manager Contact must be in format +92-XXX-XXXXXXX.",
        ),
    branchManagerEmail: z
        .string()
        .trim()
        .optional()
        .default("")
        .refine(
            (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
            "Enter a valid email address.",
        ),
    operationsManagerContact: z
        .string()
        .trim()
        .optional()
        .default("")
        .refine(
            (v) => !v || v === "+92-" || PHONE_REGEX.test(v),
            "Operations Manager Contact must be in format +92-XXX-XXXXXXX.",
        ),
    supervisorContact: z
        .string()
        .trim()
        .optional()
        .default("")
        .refine(
            (v) => !v || v === "+92-" || PHONE_REGEX.test(v),
            "Supervisor Contact must be in format +92-XXX-XXXXXXX.",
        ),

    // ── Contract dates + meta ───────────────────────────────────────────────
    contractStart: z.string().trim().optional().default(""),
    contractEnd: z.string().trim().optional().default(""),
    contractRateStart: z.string().trim().optional().default(""),
    contractRateEnd: z.string().trim().optional().default(""),
    contractAdditionalDayGuards: z.string().trim().optional().default(""),
    contractAdditionalNightGuards: z.string().trim().optional().default(""),
})

export type BranchCreateForm = z.input<typeof branchCreateSchema>

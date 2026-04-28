/**
 * Parwest ERP — Guard Create wizard zod schema
 * ─────────────────────────────────────────────────────────────────────────
 * Owner: Phase 3b' (guard create wizard)
 *
 * Mirrors the existing validation rules from the legacy enrollment form
 * (`src/app/(dashboard)/guards/new/form.tsx`) and from the API POST handler
 * (`src/app/api/guards/route.ts`). Reskin only — do NOT tighten or loosen
 * any rule. The server remains the source of truth; this schema is for
 * client-side per-step gating + nicer UX.
 *
 * Six sub-schemas (one per wizard step) are merged into `guardCreateSchema`.
 *
 * NOTE: Phase 3b sibling owns `src/lib/schemas/guard-personal.ts` — keep
 *       any further "personal" fragments there, not here.
 */

import { z } from "zod"
import {
  CNIC_REGEX,
  PHONE_REGEX,
  isValidGuardAge,
} from "@/lib/validation/formats"

// ─── Step 1: Personal Information ────────────────────────────────────────────
// Mirrors the GENERAL INFORMATION block (subset visible in the new wizard)
// + ex-service toggle from the design reference.
export const personalSchema = z.object({
  // Required identity fields (legacy: name, fatherName, motherName, cnic, dob)
  name: z.string().trim().min(1, "Full name is required."),
  fatherName: z.string().trim().min(1, "Father's name is required."),
  motherName: z.string().trim().min(1, "Mother's name is required."),
  cnic: z
    .string()
    .trim()
    .min(1, "CNIC is required.")
    .regex(CNIC_REGEX, "CNIC format must be XXXXX-XXXXXXX-X."),
  dateOfBirth: z
    .string()
    .min(1, "Date of birth is required.")
    .refine((v) => isValidGuardAge(v), "Guard must be between 18 and 65 years old."),
  // Optional / has-default identity fields
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().default("MALE"),
  maritalStatus: z.string().trim().min(1, "Marital Status is required."),
  religion: z.string().trim().optional().default("Islam"),
  bloodGroup: z.string().trim().min(1, "Blood Group is required."),
  height: z.string().trim().optional().default(""),
  weight: z.string().trim().optional().default(""),
  identificationMark: z.string().trim().optional().default(""),
  // Education (Step 1 sub-section per design reference)
  education: z.string().trim().optional().default(""),
  passingYear: z.string().trim().optional().default(""),
  educationInstitute: z.string().trim().optional().default(""),
  // Ex-service flag + meta — drives `exServiceType` on submit
  isExService: z.boolean().default(false),
  exServiceType: z.string().trim().default("CIVILIAN"),
  rank: z.string().trim().optional().default(""),
  unit: z.string().trim().optional().default(""),
})

// ─── Step 2: Service Details ─────────────────────────────────────────────────
// Mirrors regional office + supervisor + joining date from legacy form.
export const serviceSchema = z.object({
  regionalOfficeId: z.string().trim().min(1, "Regional Office is required."),
  regionId: z.string().trim().optional().default(""),
  supervisorId: z.string().trim().min(1, "Supervisor is required."),
  managerName: z.string().trim().optional().default(""),
  designation: z.string().trim().optional().default("Security Guard"),
  shift: z.enum(["DAY", "NIGHT", "ROTATING"]).optional().default("DAY"),
  joiningDate: z.string().trim().min(1, "Joining date is required."),
  policeStation: z.string().trim().min(1, "Police Station is required."),
  nationality: z.string().trim().min(1, "Nationality is required."),
  nextOfKin: z.string().trim().min(1, "Next of Kin is required."),
})

// ─── Step 3: Address & Contact ───────────────────────────────────────────────
// Mirrors the legacy ADDRESS DETAIL section + the primary contact number rule
// (at least one contact, must be +92-XXX-XXXXXXX).
export const addressSchema = z.object({
  addressPermanent: z
    .string()
    .trim()
    .min(1, "Permanent residential address is required."),
  permanentAddressContact: z
    .string()
    .trim()
    .min(1, "Permanent address contact number is required.")
    .regex(PHONE_REGEX, "Contact format must be +92-300-1234567."),
  addressCurrent: z
    .string()
    .trim()
    .min(1, "Current residential address is required."),
  currentAddressContact: z
    .string()
    .trim()
    .min(1, "Current address contact number is required.")
    .regex(PHONE_REGEX, "Contact format must be +92-300-1234567."),
  phone: z
    .string()
    .trim()
    .min(1, "At least one contact number is required.")
    .regex(PHONE_REGEX, "Contact format must be +92-300-1234567."),
  // Optional emergency contact (kept simple — legacy form embeds this in nearest-relative)
  emergencyContactName: z.string().trim().optional().default(""),
  emergencyContactRelation: z.string().trim().optional().default(""),
  emergencyContactPhone: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine(
      (v) => !v || PHONE_REGEX.test(v),
      "Contact format must be +92-300-1234567.",
    ),
  // Optional location pin (lat,lng) — surfaced only in design reference, not in API
  locationPin: z.string().trim().optional().default(""),
})

// ─── Step 4: Bank & Finance ──────────────────────────────────────────────────
// Mirrors GuardAccountsEditor's required fields. We capture a single primary
// account in the wizard; the form serialises this into `bankAccounts` JSON
// for the existing API contract.
export const bankSchema = z.object({
  bankName: z.string().trim().min(1, "Bank name is required."),
  accountNumber: z.string().trim().min(1, "Account number is required."),
  accountTitle: z.string().trim().min(1, "Account title is required."),
  branchLocation: z.string().trim().min(1, "Branch location is required."),
  iban: z.string().trim().optional().default(""),
  accountType: z
    .enum(["CURRENT", "SAVINGS", "OTHER"])
    .optional()
    .default("CURRENT"),
  // Salary + reserve % (design reference)
  salary: z
    .string()
    .trim()
    .min(1, "Basic salary is required.")
    .refine(
      (v) => Number.isFinite(Number(v)) && Number(v) >= 0,
      "Enter a valid salary amount.",
    ),
  reservePct: z.coerce
    .number()
    .min(0, "Reserve % must be ≥ 0.")
    .max(100, "Reserve % must be ≤ 100.")
    .default(30),
})

// ─── Step 5: Documents ───────────────────────────────────────────────────────
// File uploads are out-of-band; we keep boolean "received" flags here. The
// server validates the actual files on the upload endpoint.
export const documentsSchema = z.object({
  cnicCopyReceived: z.boolean().default(false),
  photoReceived: z.boolean().default(false),
  policeCertReceived: z.boolean().default(false),
  // Photo data URL — used purely for client-side preview; not persisted via this schema.
  photoDataUrl: z.string().optional().default(""),
})

// ─── Master schema ───────────────────────────────────────────────────────────
export const guardCreateSchema = personalSchema
  .merge(serviceSchema)
  .merge(addressSchema)
  .merge(bankSchema)
  .merge(documentsSchema)

/**
 * Output type — what the schema produces after parsing (post-defaults applied).
 */
export type GuardCreateInput = z.infer<typeof guardCreateSchema>

/**
 * Input type — what the form accepts BEFORE zod applies defaults. Use this
 * with `useForm<GuardCreateForm>()` so optional+default fields can be `""`
 * or `undefined` at runtime without TS errors.
 */
export type GuardCreateForm = z.input<typeof guardCreateSchema>

// ─── Step → field-name mapping ───────────────────────────────────────────────
// Used by the wizard to call `form.trigger(stepFields)` on Next.
export const STEP_FIELDS: ReadonlyArray<ReadonlyArray<keyof GuardCreateInput>> =
  [
    // Step 1: personal
    [
      "name",
      "fatherName",
      "motherName",
      "cnic",
      "dateOfBirth",
      "gender",
      "maritalStatus",
      "religion",
      "bloodGroup",
      "height",
      "weight",
      "identificationMark",
      "education",
      "passingYear",
      "educationInstitute",
      "isExService",
      "exServiceType",
      "rank",
      "unit",
    ],
    // Step 2: service
    [
      "regionalOfficeId",
      "regionId",
      "supervisorId",
      "managerName",
      "designation",
      "shift",
      "joiningDate",
      "policeStation",
      "nationality",
      "nextOfKin",
    ],
    // Step 3: address
    [
      "addressPermanent",
      "permanentAddressContact",
      "addressCurrent",
      "currentAddressContact",
      "phone",
      "emergencyContactName",
      "emergencyContactRelation",
      "emergencyContactPhone",
      "locationPin",
    ],
    // Step 4: bank
    [
      "bankName",
      "accountNumber",
      "accountTitle",
      "branchLocation",
      "iban",
      "accountType",
      "salary",
      "reservePct",
    ],
    // Step 5: documents
    [
      "cnicCopyReceived",
      "photoReceived",
      "policeCertReceived",
      "photoDataUrl",
    ],
    // Step 6: review (no fields to validate — read-only)
    [],
  ] as const

import { z } from "zod"

/**
 * Store-inventory v2 license create/edit schema.
 *
 * Mirrors the validation enforced by:
 *   - src/app/api/store-inventory/v2/licenses/route.ts POST handler
 *     (`validity` and `licenseNumber` are required; regional users must
 *     additionally pass a `clientId` they can see — but that data-dependent
 *     check stays in the API, not here).
 *   - The legacy "Save" submit gate in LicensesManager which required only
 *     a non-empty validity and license number.
 *
 * IMPORTANT: this schema MUST mirror the legacy validations exactly — do
 * not tighten or loosen. Any policy change goes through the API first.
 */

const LICENSE_VALIDITIES = [
  "Pakistan wide",
  "Province wide",
  "District wide",
  "City wide",
] as const

// Accept either an ISO date (yyyy-mm-dd) or empty string. Empty becomes null
// at the API boundary in the form's onSubmit handler.
const optionalDateString = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))

const optionalText = z.string().trim().optional().or(z.literal(""))

export const inventoryLicenseSchema = z.object({
  // Required by the API.
  validity: z
    .string()
    .trim()
    .min(1, "License validity is required"),

  // Required by the API; uniqueness is enforced server-side (P2002).
  licenseNumber: z
    .string()
    .trim()
    .min(1, "License number is required"),

  // Optional foreign keys — empty string is treated as "unset".
  clientId: optionalText,
  weaponTypeId: optionalText,
  calibreId: optionalText,

  // Free-text fields.
  weaponNumber: optionalText,
  attachmentName: optionalText,

  // ISO date strings; the form converts to null at the API boundary.
  issueDate: optionalDateString,
  expiryDate: optionalDateString,
})

export type InventoryLicenseInput = z.infer<typeof inventoryLicenseSchema>

export const INVENTORY_LICENSE_VALIDITIES = LICENSE_VALIDITIES

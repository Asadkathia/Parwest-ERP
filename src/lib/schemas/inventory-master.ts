import { z } from "zod"

/**
 * Store-inventory v2 master record create/update schema.
 *
 * Mirrors the validation enforced by:
 *   - src/app/api/store-inventory/v2/masters/[resource]/route.ts (POST/PATCH).
 *     The handler requires `name` for every resource, `type` ∈ {STORE,
 *     WAREHOUSE} for `stores`, and a non-empty `shortCode` for `units`.
 *     For `vendors` the legacy form also required `companyPhone`,
 *     `contactPerson`, `contactPersonPhone`, and `address`.
 *   - The legacy MasterManager submit gate which checked `name.trim()`
 *     (always), `shortCode.trim()` (units), and the four vendor fields
 *     when `supportsVendorFields` was set.
 *
 * IMPORTANT: this schema MUST mirror the legacy validations exactly.
 * Resource-specific required fields are enforced via a `superRefine` so a
 * single schema can drive every variant of the manager (parity with the
 * single-component reskin pattern from Adjustments / Phase 6B).
 */

const STORE_TYPES = ["STORE", "WAREHOUSE"] as const
const CATEGORY_ASSIGNEES = ["GUARD", "EMPLOYEE", "CLIENT"] as const

export type InventoryMasterStoreType = (typeof STORE_TYPES)[number]
export type InventoryMasterCategoryAssignee = (typeof CATEGORY_ASSIGNEES)[number]

/**
 * Variant flags fed into the schema so resource-specific required fields
 * can be enforced. Mirrors the prop set on `<MasterManager>`.
 */
export const inventoryMasterVariantSchema = z.object({
  supportsDescription: z.boolean().default(false),
  supportsStoreFields: z.boolean().default(false),
  supportsUnitShortCode: z.boolean().default(false),
  supportsContact: z.boolean().default(false),
  supportsCategoryFields: z.boolean().default(false),
  supportsVendorFields: z.boolean().default(false),
  supportsStatusCategory: z.boolean().default(false),
})

export type InventoryMasterVariant = z.infer<typeof inventoryMasterVariantSchema>

export const inventoryMasterFormSchema = z.object({
  // Common — every master has a name.
  name: z.string().trim().min(1, "Name is required"),

  // Optional cross-resource fields. Strings are always present (default
  // empty) so the form input/output types stay aligned for RHF.
  code: z.string(),
  shortCode: z.string(),
  description: z.string(),
  contact: z.string(),

  // Vendor fields.
  companyPhone: z.string(),
  contactPerson: z.string(),
  contactPersonPhone: z.string(),

  // Stores fields.
  type: z.enum(STORE_TYPES),
  contactNumber: z.string(),
  address: z.string(),
  regionalOfficeId: z.string(),
  prefix: z.string(),
  isHeadOffice: z.boolean(),
  latitude: z.string(),
  longitude: z.string(),

  // Categories fields.
  parentId: z.string(),
  assignee: z.array(z.enum(CATEGORY_ASSIGNEES)),

  // Statuses fields.
  categoryId: z.string(),
})

export type InventoryMasterFormInput = z.infer<typeof inventoryMasterFormSchema>

export type InventoryMasterFieldError = {
  field: keyof InventoryMasterFormInput
  message: string
}

/**
 * Resource-variant required-field validator. Returns an array of field
 * errors which the component pushes into RHF via `form.setError`. Keeps
 * the base zod schema's input/output types aligned (no `ZodEffects`
 * widening) which RHF v5 strictly type-checks.
 */
export function validateInventoryMasterVariant(
  values: InventoryMasterFormInput,
  variant: InventoryMasterVariant,
): InventoryMasterFieldError[] {
  const errors: InventoryMasterFieldError[] = []

  if (variant.supportsUnitShortCode && !values.shortCode.trim()) {
    errors.push({
      field: "shortCode",
      message: "Short code is required for units.",
    })
  }
  if (variant.supportsVendorFields) {
    if (!values.companyPhone.trim()) {
      errors.push({
        field: "companyPhone",
        message: "Company phone is required.",
      })
    }
    if (!values.contactPerson.trim()) {
      errors.push({
        field: "contactPerson",
        message: "Contact person name is required.",
      })
    }
    if (!values.contactPersonPhone.trim()) {
      errors.push({
        field: "contactPersonPhone",
        message: "Contact person phone is required.",
      })
    }
    if (!values.address.trim()) {
      errors.push({
        field: "address",
        message: "Address is required.",
      })
    }
  }

  return errors
}

export const INVENTORY_MASTER_STORE_TYPES = STORE_TYPES
export const INVENTORY_MASTER_CATEGORY_ASSIGNEES = CATEGORY_ASSIGNEES

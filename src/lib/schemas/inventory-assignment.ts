import { z } from "zod"

/**
 * Store-inventory v2 assignment schemas.
 *
 * Mirrors the validation enforced by:
 *   - src/app/api/store-inventory/v2/assignments/route.ts POST handler
 *     (`storeId` and `assignedToType` are required; the appropriate
 *     `assignedToUserId` / `assignedToGuardId` / `assignedToClientId` field
 *     is required for the variant; `lines[]` must be a non-empty array
 *     where each line has a `productId` and a positive integer `quantity`).
 *   - src/app/api/store-inventory/v2/assignments/[id]/return/route.ts
 *     (status ∈ RETURNED|DAMAGED|LOST; optional return condition + notes).
 *   - The legacy "Assign Products" submit gate in AssignmentsManager which
 *     required Store, the variant assignee, branch (CLIENT only), and at
 *     least one valid product line with quantity > 0. Per-line stock checks
 *     (quantity ≤ available) are data-dependent and stay in the component.
 *
 * IMPORTANT: this schema MUST mirror the legacy validations exactly — do
 * not tighten or loosen. Any policy change goes through the API first.
 */

const ASSIGNMENT_TYPES = ["GUARD", "EMPLOYEE", "CLIENT"] as const
const PRODUCT_SCOPES = ["NON_WEAPON", "WEAPON"] as const
const RETURN_STATUSES = ["RETURNED", "DAMAGED", "LOST"] as const

export type InventoryAssignmentType = (typeof ASSIGNMENT_TYPES)[number]
export type InventoryAssignmentProductScope = (typeof PRODUCT_SCOPES)[number]
export type InventoryAssignmentReturnStatus = (typeof RETURN_STATUSES)[number]

/**
 * Variant flags fed into the form so the variant-specific assignee field
 * can be enforced. Mirrors the prop set on `<AssignmentsManager>`.
 */
export const inventoryAssignmentVariantSchema = z.object({
  assignmentType: z.enum(ASSIGNMENT_TYPES),
  productScope: z.enum(PRODUCT_SCOPES),
})

export type InventoryAssignmentVariant = z.infer<
  typeof inventoryAssignmentVariantSchema
>

export const inventoryAssignmentLineSchema = z.object({
  productId: z.string().trim().min(1, "Product is required"),
  conditionId: z.string(),
  quantity: z
    .number({ message: "Quantity is required" })
    .int("Quantity must be a whole number")
    .positive("Quantity must be greater than zero"),
  notes: z.string(),
})

export type InventoryAssignmentLineInput = z.infer<
  typeof inventoryAssignmentLineSchema
>

/**
 * Single shared form schema covering all three variants. The variant-specific
 * required-field gate (assignedToId for any variant, branchId for CLIENT) is
 * enforced via `validateInventoryAssignmentVariant` below — this keeps the
 * RHF input/output types aligned (no `ZodEffects` widening) and mirrors the
 * pattern used by `inventoryMasterFormSchema` in `inventory-master.ts`.
 */
export const inventoryAssignmentFormSchema = z.object({
  storeId: z.string().trim().min(1, "Store is required"),
  assignedToId: z.string(),
  branchId: z.string(),
  assignedAt: z.string().trim().min(1, "Assigned at is required"),
  remarks: z.string(),
  lines: z
    .array(inventoryAssignmentLineSchema)
    .min(1, "At least one product line is required"),
})

export type InventoryAssignmentFormInput = z.infer<
  typeof inventoryAssignmentFormSchema
>

export type InventoryAssignmentFieldError = {
  field: "assignedToId" | "branchId"
  message: string
}

export function validateInventoryAssignmentVariant(
  values: InventoryAssignmentFormInput,
  variant: InventoryAssignmentVariant,
): InventoryAssignmentFieldError[] {
  const errors: InventoryAssignmentFieldError[] = []

  if (!values.assignedToId.trim()) {
    const label =
      variant.assignmentType === "GUARD"
        ? "Guard"
        : variant.assignmentType === "CLIENT"
          ? "Client"
          : "Employee"
    errors.push({ field: "assignedToId", message: `${label} is required.` })
  }

  if (variant.assignmentType === "CLIENT" && !values.branchId.trim()) {
    errors.push({
      field: "branchId",
      message: "Branch is required for client assignments.",
    })
  }

  return errors
}

export const inventoryAssignmentReturnSchema = z.object({
  status: z.enum(RETURN_STATUSES),
  returnConditionId: z.string(),
  notes: z.string(),
})

export type InventoryAssignmentReturnInput = z.infer<
  typeof inventoryAssignmentReturnSchema
>

export const INVENTORY_ASSIGNMENT_TYPES = ASSIGNMENT_TYPES
export const INVENTORY_ASSIGNMENT_PRODUCT_SCOPES = PRODUCT_SCOPES
export const INVENTORY_ASSIGNMENT_RETURN_STATUSES = RETURN_STATUSES

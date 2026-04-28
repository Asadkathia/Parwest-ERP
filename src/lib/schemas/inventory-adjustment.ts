import { z } from "zod"

/**
 * Store-inventory v2 adjustment create schema.
 *
 * Mirrors the validation enforced by:
 *   - src/app/api/store-inventory/v2/adjustments/route.ts POST handler
 *     (`storeId`, `adjustmentType`, and a non-empty `lines` array are
 *     required; each line needs a `productId` and a positive integer
 *     `quantity`. The category-scope of products is enforced server-side
 *     against the `categoryScope` field.)
 *   - The legacy "Apply Adjustment" submit gate in AdjustmentsManager which
 *     required a store, at least one line with a product and quantity > 0,
 *     and (for DECREASE lines) quantity ≤ available stock. The available-
 *     stock check is data-dependent and stays in the component, not here.
 *
 * IMPORTANT: this schema MUST mirror the legacy validations exactly — do
 * not tighten or loosen. Any policy change goes through the API first.
 */

const ADJUSTMENT_LINE_ACTIONS = ["INCREASE", "DECREASE"] as const
const CATEGORY_SCOPES = ["NON_WEAPON", "WEAPON_AMMO"] as const

export const inventoryAdjustmentLineSchema = z.object({
  // Product id from the v2 catalog; required.
  productId: z.string().trim().min(1, "Product is required"),

  // Positive integer quantity (legacy form used Number(qty) > 0 and
  // <input type="number" min={1}>).
  quantity: z
    .number({ message: "Quantity is required" })
    .int("Quantity must be a whole number")
    .positive("Quantity must be greater than zero"),

  // Optional condition id — empty string acceptable for "New".
  conditionId: z.string().trim().optional().or(z.literal("")),

  // Per-line action: only INCREASE / DECREASE are exposed in the legacy UI.
  // The server also accepts SET, but the legacy form never emitted it.
  action: z.enum(ADJUSTMENT_LINE_ACTIONS, {
    message: "Action is required",
  }),
})

export const inventoryAdjustmentCreateSchema = z.object({
  // Selected store; required by the API.
  storeId: z.string().trim().min(1, "Store is required"),

  // Free-text note attached to the adjustment header.
  notes: z.string().trim().optional().or(z.literal("")),

  // At least one line must be present and valid.
  lines: z
    .array(inventoryAdjustmentLineSchema)
    .min(1, "At least one product line is required"),

  // Category scope from the screen route; the API rejects mismatched
  // products (e.g. weapon products in a regular adjustment).
  categoryScope: z.enum(CATEGORY_SCOPES),
})

export type InventoryAdjustmentLineInput = z.infer<
  typeof inventoryAdjustmentLineSchema
>
export type InventoryAdjustmentCreateInput = z.infer<
  typeof inventoryAdjustmentCreateSchema
>

export const INVENTORY_ADJUSTMENT_LINE_ACTIONS = ADJUSTMENT_LINE_ACTIONS
export const INVENTORY_ADJUSTMENT_CATEGORY_SCOPES = CATEGORY_SCOPES

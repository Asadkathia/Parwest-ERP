import { z } from "zod"

/**
 * Store-inventory v2 demand schemas.
 *
 * Mirrors the validation enforced by:
 *   - src/app/api/store-inventory/v2/demands/route.ts POST handler
 *     (`fromStoreId` and `toStoreId` are required for creation; lines must
 *     be a non-empty array; each line needs a `productId` and a positive
 *     integer `requestedQty`. Server-side workflow rules
 *     (`inventoryDemand.requirePendingInitialStatus`,
 *     `inventoryDemand.enforceTransitionMap`,
 *     `inventoryDemand.blockCoreEditsAfterTerminal`,
 *     `inventoryDemand.requireSufficientStockForFulfillment`) are enforced
 *     in the API; the client mirrors only what's surfaced as an inline hint.)
 *   - The legacy "Create Demand" submit gate in DemandsManager which
 *     required From Store, To Warehouse, and at least one valid product
 *     line with quantity > 0.
 *   - The legacy "Allocate" gate which required at least one allocated
 *     quantity > 0 and that allocated qty not exceed warehouse stock
 *     (data-dependent — stays in component).
 *
 * IMPORTANT: this schema MUST mirror the legacy validations exactly — do
 * not tighten or loosen. Any policy change goes through the API first.
 */

export const inventoryDemandLineSchema = z.object({
  // Product id from the v2 catalog; required.
  productId: z.string().trim().min(1, "Product is required"),

  // Positive integer quantity (legacy form used Number(qty) > 0 and
  // <input type="number" min={1}>).
  requestedQty: z
    .number({ message: "Quantity is required" })
    .int("Quantity must be a whole number")
    .positive("Quantity must be greater than zero"),

  // Optional per-line note (legacy form did not expose, but API accepts).
  notes: z.string().trim().optional().or(z.literal("")),
})

export const inventoryDemandCreateSchema = z.object({
  // Requesting store; required.
  fromStoreId: z.string().trim().min(1, "From Store is required"),

  // Target warehouse; required.
  toStoreId: z.string().trim().min(1, "To Warehouse is required"),

  // Free-text request remarks attached to the demand header.
  reason: z.string().trim().optional().or(z.literal("")),

  // At least one line must be present and valid.
  lines: z
    .array(inventoryDemandLineSchema)
    .min(1, "At least one product line is required"),
})

/**
 * Allocation (response) schema for the warehouse-side responder.
 *
 * Mirrors `POST /api/store-inventory/v2/demands/[id]/responses`. The legacy
 * gate required at least one allocated qty > 0; the per-line bound checks
 * (newQty ≤ availableQty, reusableQty ≤ reusableQty) depend on loaded
 * inventory balances and stay in the component as runtime guards.
 */
export const inventoryDemandResponseLineSchema = z.object({
  demandLineId: z.string().trim().min(1),
  newQty: z
    .number({ message: "New qty is required" })
    .int("Quantity must be a whole number")
    .nonnegative("Quantity must be zero or positive"),
  reusableAllocQty: z
    .number({ message: "Reusable qty is required" })
    .int("Quantity must be a whole number")
    .nonnegative("Quantity must be zero or positive"),
  notes: z.string().trim().optional().or(z.literal("")),
})

export const inventoryDemandResponseSchema = z.object({
  responseRemarks: z.string().trim().optional().or(z.literal("")),
  lines: z
    .array(inventoryDemandResponseLineSchema)
    .min(1, "At least one response line is required"),
})

export type InventoryDemandLineInput = z.infer<typeof inventoryDemandLineSchema>
export type InventoryDemandCreateInput = z.infer<
  typeof inventoryDemandCreateSchema
>
export type InventoryDemandResponseLineInput = z.infer<
  typeof inventoryDemandResponseLineSchema
>
export type InventoryDemandResponseInput = z.infer<
  typeof inventoryDemandResponseSchema
>

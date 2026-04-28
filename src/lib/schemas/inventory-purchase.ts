import { z } from "zod"

/**
 * Store-inventory v2 purchase create schema.
 *
 * Mirrors the validation enforced by:
 *   - src/app/api/store-inventory/v2/purchases/route.ts POST handler
 *     (`storeId` and a non-empty `lines` array are required; each line
 *     needs a `productId` and a positive integer `quantity`. Category-scope
 *     of products is enforced server-side against the `categoryScope`
 *     field. The API additionally accepts `vendorId`, `attachmentUrl`,
 *     `purchasedAt`, optional purchase-order metadata
 *     `approvalReference` / `invoiceNumber` / `invoiceDate` /
 *     `deliveryChallanNumber`, and a free-text `note`.)
 *   - The legacy "Add Purchase" submit gate in PurchasesManager which
 *     required Store/Warehouse, Vendor, and Purchase Date, and a valid
 *     product line with quantity > 0.
 *
 * Receiving (`/[id]/receive`) and reject (PATCH status:CANCELLED) flows
 * have their own data-dependent guards which stay in the component.
 *
 * IMPORTANT: this schema MUST mirror the legacy validations exactly — do
 * not tighten or loosen. Any policy change goes through the API first.
 */

const CATEGORY_SCOPES = ["NON_WEAPON", "WEAPON"] as const

export const inventoryPurchaseLineSchema = z.object({
  // Product id from the v2 catalog; required.
  productId: z.string().trim().min(1, "Product is required"),

  // Positive integer quantity (legacy form used Number(qty) > 0 and
  // <input type="number" min={1}>).
  quantity: z
    .number({ message: "Quantity is required" })
    .int("Quantity must be a whole number")
    .positive("Quantity must be greater than zero"),

  // Per-line unit cost. Legacy default was 1; API accepts null/number.
  // Allow >= 0 (free items not exposed in the legacy UI but the legacy
  // form had min={0}).
  unitCost: z
    .number({ message: "Price is required" })
    .nonnegative("Price must be zero or positive"),

  // Optional per-line note.
  notes: z.string().trim().optional().or(z.literal("")),
})

export const inventoryPurchaseCreateSchema = z.object({
  // Selected store; required by the API and by the legacy submit guard.
  storeId: z.string().trim().min(1, "Store/Warehouse is required"),

  // Selected vendor; required by the legacy submit guard.
  vendorId: z.string().trim().min(1, "Vendor is required"),

  // Optional attachment file name (legacy form stored only the name).
  attachmentName: z.string().trim().optional().or(z.literal("")),

  // Required purchase date (legacy form defaulted to today and required
  // a non-empty value).
  purchasedAt: z.string().trim().min(1, "Purchase Date is required"),

  // Optional free-text note.
  note: z.string().trim().optional().or(z.literal("")),

  // Optional purchase-order metadata.
  approvalReference: z.string().trim().optional().or(z.literal("")),
  invoiceNumber: z.string().trim().optional().or(z.literal("")),
  invoiceDate: z.string().trim().optional().or(z.literal("")),
  deliveryChallanNumber: z.string().trim().optional().or(z.literal("")),

  // At least one line must be present and valid.
  lines: z
    .array(inventoryPurchaseLineSchema)
    .min(1, "At least one product line is required"),

  // Category scope from the screen route; the API rejects mismatched
  // products (e.g. weapon products in a regular purchase).
  categoryScope: z.enum(CATEGORY_SCOPES),
})

export type InventoryPurchaseLineInput = z.infer<
  typeof inventoryPurchaseLineSchema
>
export type InventoryPurchaseCreateInput = z.infer<
  typeof inventoryPurchaseCreateSchema
>

export const INVENTORY_PURCHASE_CATEGORY_SCOPES = CATEGORY_SCOPES

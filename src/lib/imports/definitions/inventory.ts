import { z } from "zod"

import { getInventoryV2Flags } from "@/lib/inventory/v2-flags"
import { registerImport } from "@/lib/imports/registry"
import { nonNegativeInt, optionalString, requiredString } from "@/lib/imports/rules"
import type { ColumnDescriptor } from "@/lib/imports/types"

/**
 * Inventory v2 bulk import.
 *
 * This is the only legacy module that actually writes to the database.
 * The persistence path is the same store/brand/unit/status/product/balance
 * upsert chain that lived inline in `workflow.ts::processInventoryRows`,
 * now expressed as a definition so the generic engine can drive it.
 */
function toSlug(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
}

const rowSchema = z
  .object({
    sku: optionalString(64),
    name: requiredString("name", 200),
    storeCode: optionalString(64),
    storeName: optionalString(200),
    quantityOnHand: nonNegativeInt("quantityOnHand").optional(),
    quantity: nonNegativeInt("quantity").optional(),
    avgUnitCost: z
      .preprocess(
        (v) => (v == null || v === "" ? undefined : Number(String(v).trim())),
        z.number().nonnegative().optional(),
      ),
    unitCost: z
      .preprocess(
        (v) => (v == null || v === "" ? undefined : Number(String(v).trim())),
        z.number().nonnegative().optional(),
      ),
    brand: optionalString(120),
    unit: optionalString(64),
    category: optionalString(120),
    status: optionalString(64),
  })
  .refine(
    (row) => {
      const hasV2 = Boolean(row.sku && row.name && row.storeCode)
      const hasLegacy = Boolean(row.name && row.category)
      return hasV2 || hasLegacy
    },
    {
      path: ["__row__"],
      message:
        "Each row must include either v2 shape (sku + name + storeCode) or legacy shape (name + category).",
    },
  )

registerImport({
  module: "inventory",
  label: "Inventory v2",
  description: "Upsert store + product + balance in a single sheet (Inventory v2).",
  requiredHeaders: ["name"],
  optionalHeaders: [
    "sku",
    "storeCode",
    "storeName",
    "quantityOnHand",
    "quantity",
    "avgUnitCost",
    "unitCost",
    "brand",
    "unit",
    "category",
    "status",
  ],
  rowSchema,
  duplicates: [{ fields: ["sku"], scope: "payload", message: "Duplicate SKU in upload" }],
  columns: [
    { key: "name", header: "name", label: "Name", kind: "text", required: true },
    { key: "sku", header: "sku", label: "SKU", kind: "text", required: false },
    {
      key: "storeCode",
      header: "storeCode",
      label: "Store Code",
      kind: "fk",
      required: false,
      fkOptionsLoader: async (ctx) => {
        const rows = await ctx.prisma.store.findMany({
          where: { isActive: true },
          select: { code: true, name: true },
          orderBy: { code: "asc" },
        })
        return rows.map((r) => ({ value: r.code, label: `${r.code} — ${r.name}` }))
      },
    },
    { key: "storeName", header: "storeName", label: "Store Name", kind: "text", required: false },
    { key: "quantityOnHand", header: "quantityOnHand", label: "Quantity On Hand", kind: "number", required: false },
    { key: "quantity", header: "quantity", label: "Quantity", kind: "number", required: false },
    { key: "avgUnitCost", header: "avgUnitCost", label: "Avg Unit Cost", kind: "number", required: false },
    { key: "unitCost", header: "unitCost", label: "Unit Cost", kind: "number", required: false },
    { key: "brand", header: "brand", label: "Brand", kind: "text", required: false },
    { key: "unit", header: "unit", label: "Unit", kind: "text", required: false },
    { key: "category", header: "category", label: "Category", kind: "text", required: false },
    {
      key: "status",
      header: "status",
      label: "Status",
      kind: "enum",
      required: false,
      enumValues: ["ACTIVE", "INACTIVE"],
    },
  ] satisfies ColumnDescriptor[],
  sampleRows: [
    {
      sku: "WT-001",
      name: "Walkie Talkie",
      storeCode: "RO-L",
      quantityOnHand: 12,
      brand: "Motorola",
      unit: "PCS",
      status: "ACTIVE",
    },
    {
      sku: "UF-001",
      name: "Uniform Set",
      storeCode: "RO-L",
      quantityOnHand: 50,
      brand: "Parwest",
      unit: "SET",
      status: "ACTIVE",
    },
  ],
  persist: async (row, ctx) => {
    const flags = getInventoryV2Flags()
    if (!flags.writeEnabled) {
      throw new Error(
        "Inventory v2 write flag is disabled. Set INVENTORY_V2_WRITE_ENABLED=true before processing imports.",
      )
    }

    const r = row as {
      sku?: string
      name: string
      storeCode?: string
      storeName?: string
      quantityOnHand?: number
      quantity?: number
      avgUnitCost?: number
      unitCost?: number
      brand?: string
      unit?: string
      status?: string
    }

    const sku = r.sku || `LEG-${toSlug(r.name)}-${Date.now()}`
    const storeCode = r.storeCode || "RO-UNASSIGNED"
    const storeName = r.storeName || `${storeCode} Imported Store`
    const quantityOnHand = Math.max(0, Math.round(r.quantityOnHand ?? r.quantity ?? 0))
    const avgUnitCostRaw = r.avgUnitCost ?? r.unitCost ?? 0
    const avgUnitCost = avgUnitCostRaw > 0 ? avgUnitCostRaw : null
    const statusName = r.status || "ACTIVE"

    const { tx } = ctx

    const store = await tx.store.upsert({
      where: { code: storeCode },
      create: { code: storeCode, name: storeName, type: "IMPORTED", isActive: true },
      update: { name: storeName, isActive: true },
    })

    const brand = r.brand
      ? await tx.storeInventoryBrand.upsert({
          where: { name: r.brand },
          create: { name: r.brand },
          update: {},
        })
      : null

    const unit = r.unit
      ? await tx.storeInventoryUnit.upsert({
          where: { name: r.unit },
          create: { name: r.unit, shortCode: toSlug(r.unit).slice(0, 8) || "UNIT" },
          update: {},
        })
      : null

    const status = await tx.storeInventoryStatus.upsert({
      where: { name: statusName },
      create: { name: statusName },
      update: {},
    })

    const product = await tx.storeInventoryProduct.upsert({
      where: { sku },
      create: {
        sku,
        name: r.name,
        brandId: brand?.id ?? null,
        unitId: unit?.id ?? null,
        statusId: status.id,
        serialRequired: false,
      },
      update: {
        name: r.name,
        brandId: brand?.id ?? null,
        unitId: unit?.id ?? null,
        statusId: status.id,
      },
    })

    await tx.storeInventoryBalance.upsert({
      where: { storeId_productId: { storeId: store.id, productId: product.id } },
      create: { storeId: store.id, productId: product.id, quantityOnHand, avgUnitCost },
      update: { quantityOnHand, avgUnitCost },
    })
  },
})

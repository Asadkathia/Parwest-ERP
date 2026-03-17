import "dotenv/config"
import { Pool } from "pg"

const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED
if (!databaseUrl) {
  console.error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED.")
  process.exit(1)
}

const execute = process.env.INVENTORY_V2_LEGACY_BACKFILL_EXECUTE === "true"
const pool = new Pool({ connectionString: databaseUrl })

function normalizeOfficeKey(value) {
  return value ?? "UNASSIGNED"
}

async function main() {
  console.log(`[inventory-v2-legacy-backfill] Mode: ${execute ? "execute" : "dry-run"}`)

  const [officesRes, categoriesRes, legacyAggRes] = await Promise.all([
    pool.query(`SELECT id, name, "seriesCode" FROM "RegionalOffice" ORDER BY name ASC`),
    pool.query(`SELECT id, name FROM "InventoryCategory" ORDER BY name ASC`),
    pool.query(`
      SELECT
        COALESCE(ii."regionalOfficeId", 'UNASSIGNED') AS office_id,
        ii."categoryId" AS category_id,
        COALESCE(SUM(CASE WHEN ii."isNonUnique" THEN GREATEST(COALESCE(ii.quantity, 1), 1) ELSE 1 END), 0)::int AS total_units,
        COALESCE(SUM(CASE WHEN ii.status = 'ISSUED' THEN CASE WHEN ii."isNonUnique" THEN GREATEST(COALESCE(ii.quantity, 1), 1) ELSE 1 END ELSE 0 END), 0)::int AS issued_units
      FROM "InventoryItem" ii
      GROUP BY COALESCE(ii."regionalOfficeId", 'UNASSIGNED'), ii."categoryId"
      ORDER BY office_id ASC, category_id ASC
    `),
  ])

  const officeById = new Map(officesRes.rows.map((r) => [r.id, r]))
  const categoryById = new Map(categoriesRes.rows.map((r) => [r.id, r]))

  const storePlans = officesRes.rows.map((office) => ({
    code: `RO-${office.seriesCode}`,
    name: `${office.name} Store`,
    regionalOfficeId: office.id,
  }))
  if (legacyAggRes.rows.some((r) => r.office_id === "UNASSIGNED")) {
    storePlans.push({
      code: "RO-UNASSIGNED",
      name: "Unassigned Legacy Inventory Store",
      regionalOfficeId: null,
    })
  }

  const productPlans = categoriesRes.rows.map((cat) => ({
    categoryId: cat.id,
    sku: `LEGACY-CAT-${cat.id}`,
    name: `Legacy ${cat.name}`,
    description: `Auto-migrated from legacy category ${cat.name}`,
  }))

  const balancePlans = legacyAggRes.rows.map((row) => {
    const officeId = normalizeOfficeKey(row.office_id)
    const categoryId = row.category_id
    const totalUnits = Number(row.total_units || 0)
    const issuedUnits = Number(row.issued_units || 0)
    const onHandUnits = Math.max(totalUnits - issuedUnits, 0)

    const office = officeId === "UNASSIGNED" ? null : officeById.get(officeId)
    const category = categoryById.get(categoryId)

    const storeCode = office ? `RO-${office.seriesCode}` : "RO-UNASSIGNED"
    const sku = `LEGACY-CAT-${categoryId}`

    return {
      officeId,
      categoryId,
      officeName: office?.name ?? "Unassigned",
      categoryName: category?.name ?? categoryId,
      storeCode,
      sku,
      totalUnits,
      issuedUnits,
      onHandUnits,
    }
  })

  const summary = {
    offices: officesRes.rowCount,
    categories: categoriesRes.rowCount,
    storePlans: storePlans.length,
    productPlans: productPlans.length,
    balancePlans: balancePlans.length,
    legacyUnits: balancePlans.reduce((sum, row) => sum + row.totalUnits, 0),
    legacyIssued: balancePlans.reduce((sum, row) => sum + row.issuedUnits, 0),
  }

  console.log("[inventory-v2-legacy-backfill] Plan summary:")
  for (const [k, v] of Object.entries(summary)) {
    console.log(`  - ${k}: ${v}`)
  }

  if (!execute) {
    console.log("[inventory-v2-legacy-backfill] Dry run complete. Set INVENTORY_V2_LEGACY_BACKFILL_EXECUTE=true to apply.")
    return
  }

  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    for (const store of storePlans) {
      await client.query(
        `
          INSERT INTO "Store" ("id", "code", "name", "regionalOfficeId", "isActive", "createdAt", "updatedAt")
          VALUES (concat('st_', md5(random()::text || clock_timestamp()::text)), $1, $2, $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT ("code") DO UPDATE
          SET "name" = EXCLUDED."name",
              "regionalOfficeId" = EXCLUDED."regionalOfficeId",
              "isActive" = true,
              "updatedAt" = CURRENT_TIMESTAMP
        `,
        [store.code, store.name, store.regionalOfficeId]
      )
    }

    for (const product of productPlans) {
      await client.query(
        `
          INSERT INTO "StoreInventoryProduct" (
            "id", "sku", "name", "description", "serialRequired", "createdAt", "updatedAt"
          )
          VALUES (
            concat('sip_', md5(random()::text || clock_timestamp()::text)),
            $1, $2, $3, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT ("sku") DO UPDATE
          SET "name" = EXCLUDED."name",
              "description" = EXCLUDED."description",
              "updatedAt" = CURRENT_TIMESTAMP
        `,
        [product.sku, product.name, product.description]
      )
    }

    for (const row of balancePlans) {
      await client.query(
        `
          INSERT INTO "StoreInventoryBalance" (
            "id", "quantityOnHand", "quantityHeld", "quantityIssued", "avgUnitCost", "updatedAt", "storeId", "productId"
          )
          VALUES (
            concat('sib_', md5(random()::text || clock_timestamp()::text)),
            $1, 0, $2, NULL, CURRENT_TIMESTAMP,
            (SELECT id FROM "Store" WHERE "code" = $3 LIMIT 1),
            (SELECT id FROM "StoreInventoryProduct" WHERE "sku" = $4 LIMIT 1)
          )
          ON CONFLICT ("storeId", "productId") DO UPDATE
          SET "quantityOnHand" = EXCLUDED."quantityOnHand",
              "quantityHeld" = EXCLUDED."quantityHeld",
              "quantityIssued" = EXCLUDED."quantityIssued",
              "updatedAt" = CURRENT_TIMESTAMP
        `,
        [row.onHandUnits, row.issuedUnits, row.storeCode, row.sku]
      )
    }

    await client.query("COMMIT")
    console.log("[inventory-v2-legacy-backfill] Backfill applied successfully.")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

main()
  .catch((error) => {
    console.error("[inventory-v2-legacy-backfill] Failed:", error.message)
    process.exit(1)
  })
  .finally(async () => {
    await pool.end()
  })

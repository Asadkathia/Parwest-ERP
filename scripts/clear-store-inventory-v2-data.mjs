import "dotenv/config"
import { Pool } from "pg"

const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED
if (!databaseUrl) {
  console.error("[inventory-v2-clear] Missing DATABASE_URL or DATABASE_URL_UNPOOLED.")
  process.exit(1)
}

const execute = process.env.INVENTORY_V2_CLEAR_EXECUTE === "true"
const pool = new Pool({ connectionString: databaseUrl })

const TARGET_TABLES = [
  "StoreInventoryDemandResponseLine",
  "StoreInventoryDemandResponse",
  "StoreInventoryDemandLine",
  "StoreInventoryDemand",
  "StoreInventoryAssignment",
  "StoreInventoryMovement",
  "StoreInventoryAdjustmentLine",
  "StoreInventoryAdjustment",
  "StoreInventoryPurchaseLine",
  "StoreInventoryPurchase",
  "StoreInventoryBalance",
  "StoreInventoryLicense",
  "StoreInventoryProduct",
  "StoreInventoryStatus",
  "StoreInventoryCategory",
  "StoreInventoryRepairing",
  "StoreInventoryVariation",
  "StoreInventoryLicenseType",
  "StoreInventoryCalibre",
  "StoreInventoryWeaponType",
  "StoreInventoryConditionV2",
  "StoreInventoryUnit",
  "StoreInventoryBrand",
  "InventoryVendor",
  "Store",
]

async function existingTables(client, tableNames) {
  const result = await client.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name ASC
    `,
    [tableNames]
  )
  return result.rows.map((row) => row.table_name)
}

async function main() {
  const client = await pool.connect()
  try {
    const tables = await existingTables(client, TARGET_TABLES)

    if (tables.length === 0) {
      console.log("[inventory-v2-clear] No target tables found; nothing to clear.")
      return
    }

    console.log("[inventory-v2-clear] Mode:", execute ? "execute" : "dry-run")
    console.log("[inventory-v2-clear] Target tables:")
    for (const table of tables) {
      const countResult = await client.query(`SELECT COUNT(*)::int AS count FROM "${table}"`)
      console.log(`  - ${table}: ${countResult.rows[0].count}`)
    }

    if (!execute) {
      console.log("[inventory-v2-clear] Dry-run complete. Set INVENTORY_V2_CLEAR_EXECUTE=true to wipe data.")
      return
    }

    await client.query("BEGIN")
    const truncateSql = `TRUNCATE TABLE ${tables.map((table) => `"${table}"`).join(", ")} RESTART IDENTITY CASCADE`
    await client.query(truncateSql)
    await client.query("COMMIT")

    console.log("[inventory-v2-clear] Store/inventory data cleared successfully.")
  } catch (error) {
    try {
      await client.query("ROLLBACK")
    } catch {
      // no-op
    }
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error("[inventory-v2-clear] Failed:", error.message)
  process.exit(1)
})

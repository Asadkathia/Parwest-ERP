import process from "node:process"
import dotenv from "dotenv"
import { Pool } from "pg"

dotenv.config()

const TRUE_VALUES = new Set(["1", "true", "yes", "on"])

function envBool(name, defaultValue = false) {
  const raw = process.env[name]
  if (raw == null) return defaultValue
  return TRUE_VALUES.has(String(raw).trim().toLowerCase())
}

const PRODUCT_FILTER = `(p.sku ILIKE 'INV2-SKU-%' OR p.name ILIKE 'Inventory V2 Product %' OR p.sku ILIKE 'IMPORT-%' OR p.name ILIKE 'Imported Inventory Product%')`
const STORE_FILTER = `(s.code ILIKE 'INV2-%' OR s.name ILIKE 'Inventory V2 %')`
const SUSPICIOUS_PRODUCTS_SUBQUERY = `SELECT p.id FROM "StoreInventoryProduct" p WHERE ${PRODUCT_FILTER}`
const SUSPICIOUS_STORES_SUBQUERY = `SELECT s.id FROM "Store" s WHERE ${STORE_FILTER}`

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED
  if (!databaseUrl) throw new Error("DATABASE_URL or DATABASE_URL_UNPOOLED is required.")

  const apply = envBool("APPLY_INVENTORY_V2_TEST_CLEANUP", false)
  const pool = new Pool({ connectionString: databaseUrl })

  try {
    const counts = await pool.query(`
      WITH suspicious_products AS (
        SELECT p.id FROM "StoreInventoryProduct" p WHERE ${PRODUCT_FILTER}
      ),
      suspicious_stores AS (
        SELECT s.id FROM "Store" s WHERE ${STORE_FILTER}
      )
      SELECT
        (SELECT COUNT(*)::int FROM suspicious_products) AS suspicious_products,
        (SELECT COUNT(*)::int FROM suspicious_stores) AS suspicious_stores,
        (SELECT COUNT(*)::int FROM "StoreInventoryBalance" b WHERE b."productId" IN (SELECT id FROM suspicious_products) OR b."storeId" IN (SELECT id FROM suspicious_stores)) AS balances,
        (SELECT COUNT(*)::int FROM "StoreInventoryMovement" m WHERE m."productId" IN (SELECT id FROM suspicious_products) OR m."storeId" IN (SELECT id FROM suspicious_stores)) AS movements,
        (SELECT COUNT(*)::int FROM "StoreInventoryAssignment" a WHERE a."productId" IN (SELECT id FROM suspicious_products) OR a."storeId" IN (SELECT id FROM suspicious_stores)) AS assignments,
        (SELECT COUNT(*)::int FROM "StoreInventoryPurchase" pu WHERE pu."storeId" IN (SELECT id FROM suspicious_stores)) AS purchases,
        (SELECT COUNT(*)::int FROM "StoreInventoryAdjustment" ad WHERE ad."storeId" IN (SELECT id FROM suspicious_stores)) AS adjustments,
        (SELECT COUNT(*)::int FROM "StoreInventoryDemand" d WHERE d."fromStoreId" IN (SELECT id FROM suspicious_stores) OR d."toStoreId" IN (SELECT id FROM suspicious_stores)) AS demands,
        (SELECT COUNT(*)::int FROM "StoreInventoryDemandResponse" dr WHERE dr."responderStoreId" IN (SELECT id FROM suspicious_stores)) AS demand_responses,
        (SELECT COUNT(*)::int FROM "StoreInventoryDemandLine" dl WHERE dl."productId" IN (SELECT id FROM suspicious_products)) AS demand_lines,
        (SELECT COUNT(*)::int FROM "StoreInventoryDemandResponseLine" drl WHERE drl."productId" IN (SELECT id FROM suspicious_products)) AS demand_response_lines,
        (SELECT COUNT(*)::int FROM "StoreInventoryAdjustmentLine" al WHERE al."productId" IN (SELECT id FROM suspicious_products)) AS adjustment_lines,
        (SELECT COUNT(*)::int FROM "StoreInventoryPurchaseLine" pl WHERE pl."productId" IN (SELECT id FROM suspicious_products)) AS purchase_lines
    `)

    const row = counts.rows[0]
    console.log("[inventory-v2-cleanup] Dry-run counts:")
    for (const [key, value] of Object.entries(row)) {
      console.log(`  - ${key}: ${value}`)
    }

    if (!apply) {
      console.log("[inventory-v2-cleanup] Dry run only. Set APPLY_INVENTORY_V2_TEST_CLEANUP=true to execute deletions.")
      return
    }

    const client = await pool.connect()
    try {
      await client.query("BEGIN")

      const suspiciousDemandsSubquery = `
        SELECT d.id
        FROM "StoreInventoryDemand" d
        WHERE d."fromStoreId" IN (${SUSPICIOUS_STORES_SUBQUERY})
           OR d."toStoreId" IN (${SUSPICIOUS_STORES_SUBQUERY})
      `

      const suspiciousResponsesSubquery = `
        SELECT r.id
        FROM "StoreInventoryDemandResponse" r
        WHERE r."responderStoreId" IN (${SUSPICIOUS_STORES_SUBQUERY})
           OR r."demandId" IN (${suspiciousDemandsSubquery})
      `

      await client.query(`
        DELETE FROM "StoreInventoryDemandResponseLine" drl
        WHERE drl."responseId" IN (${suspiciousResponsesSubquery})
           OR drl."productId" IN (${SUSPICIOUS_PRODUCTS_SUBQUERY})
      `)
      await client.query(`DELETE FROM "StoreInventoryDemandResponse" r WHERE r.id IN (${suspiciousResponsesSubquery})`)
      await client.query(`
        DELETE FROM "StoreInventoryDemandLine" dl
        WHERE dl."demandId" IN (${suspiciousDemandsSubquery})
           OR dl."productId" IN (${SUSPICIOUS_PRODUCTS_SUBQUERY})
      `)
      await client.query(`DELETE FROM "StoreInventoryDemand" d WHERE d.id IN (${suspiciousDemandsSubquery})`)

      await client.query(`
        DELETE FROM "StoreInventoryAdjustmentLine" al
        USING "StoreInventoryAdjustment" ad
        WHERE al."adjustmentId" = ad.id
          AND (al."productId" IN (${SUSPICIOUS_PRODUCTS_SUBQUERY}) OR ad."storeId" IN (${SUSPICIOUS_STORES_SUBQUERY}))
      `)
      await client.query(`DELETE FROM "StoreInventoryAdjustment" ad WHERE ad."storeId" IN (${SUSPICIOUS_STORES_SUBQUERY})`)

      await client.query(`
        DELETE FROM "StoreInventoryPurchaseLine" pl
        USING "StoreInventoryPurchase" pu
        WHERE pl."purchaseId" = pu.id
          AND (pl."productId" IN (${SUSPICIOUS_PRODUCTS_SUBQUERY}) OR pu."storeId" IN (${SUSPICIOUS_STORES_SUBQUERY}))
      `)
      await client.query(`DELETE FROM "StoreInventoryPurchase" pu WHERE pu."storeId" IN (${SUSPICIOUS_STORES_SUBQUERY})`)

      await client.query(`
        DELETE FROM "StoreInventoryMovement" m
        WHERE m."productId" IN (${SUSPICIOUS_PRODUCTS_SUBQUERY})
           OR m."storeId" IN (${SUSPICIOUS_STORES_SUBQUERY})
      `)
      await client.query(`
        DELETE FROM "StoreInventoryAssignment" a
        WHERE a."productId" IN (${SUSPICIOUS_PRODUCTS_SUBQUERY})
           OR a."storeId" IN (${SUSPICIOUS_STORES_SUBQUERY})
      `)
      await client.query(`
        DELETE FROM "StoreInventoryBalance" b
        WHERE b."productId" IN (${SUSPICIOUS_PRODUCTS_SUBQUERY})
           OR b."storeId" IN (${SUSPICIOUS_STORES_SUBQUERY})
      `)
      await client.query(`DELETE FROM "StoreInventoryProduct" p WHERE ${PRODUCT_FILTER}`)
      await client.query(`DELETE FROM "Store" s WHERE ${STORE_FILTER}`)

      await client.query("COMMIT")
      console.log("[inventory-v2-cleanup] Cleanup applied successfully.")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error("[inventory-v2-cleanup] Failed:", error.message)
  process.exit(1)
})

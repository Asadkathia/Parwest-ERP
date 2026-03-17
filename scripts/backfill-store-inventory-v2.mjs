import "dotenv/config"
import { Pool } from "pg"

const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

if (!databaseUrl) {
  console.error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED.")
  process.exit(1)
}

const execute = process.env.STORE_INV_V2_BACKFILL_EXECUTE === "true"
const dryRun = !execute

const pool = new Pool({ connectionString: databaseUrl })

function pad(value, len = 2) {
  return String(value).padStart(len, "0")
}

function dateStamp(date = new Date()) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

try {
  console.log(`Store inventory v2 backfill starting (${dryRun ? "dry-run" : "execute"}) on ${dateStamp()}.`)

  const officesResult = await pool.query(
    `
      SELECT id, name, "seriesCode"
      FROM "RegionalOffice"
      ORDER BY name ASC
    `
  )

  const inventoryCountsResult = await pool.query(
    `
      SELECT COALESCE("regionalOfficeId", 'UNASSIGNED') AS office_id, COUNT(*)::int AS item_count
      FROM "InventoryItem"
      GROUP BY COALESCE("regionalOfficeId", 'UNASSIGNED')
      ORDER BY office_id ASC
    `
  )

  const countsByOffice = new Map(
    inventoryCountsResult.rows.map((row) => [row.office_id, row.item_count])
  )

  const plannedStores = officesResult.rows.map((office) => ({
    code: `RO-${office.seriesCode}`,
    name: `${office.name} Store`,
    regionalOfficeId: office.id,
    estimatedLegacyItems: countsByOffice.get(office.id) ?? 0,
  }))

  const unassignedCount = countsByOffice.get("UNASSIGNED") ?? 0
  if (unassignedCount > 0) {
    plannedStores.push({
      code: "RO-UNASSIGNED",
      name: "Unassigned Legacy Inventory Store",
      regionalOfficeId: null,
      estimatedLegacyItems: unassignedCount,
    })
  }

  console.log(`Regional offices found: ${officesResult.rowCount}`)
  console.log(`Legacy inventory groups: ${inventoryCountsResult.rowCount}`)
  console.log(`Planned stores: ${plannedStores.length}`)

  for (const store of plannedStores) {
    console.log(
      `- ${store.code} | ${store.name} | office=${store.regionalOfficeId ?? "null"} | legacyItems=${store.estimatedLegacyItems}`
    )
  }

  if (dryRun) {
    console.log("Dry-run complete. Set STORE_INV_V2_BACKFILL_EXECUTE=true to persist changes.")
    process.exit(0)
  }

  await pool.query("BEGIN")

  for (const store of plannedStores) {
    await pool.query(
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

  await pool.query("COMMIT")
  console.log("Backfill execute complete: stores upserted.")
} catch (error) {
  await pool.query("ROLLBACK").catch(() => {})
  console.error("Backfill failed:", error)
  process.exit(1)
} finally {
  await pool.end()
}

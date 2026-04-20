import "dotenv/config"
import { Pool } from "pg"

const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED
if (!databaseUrl) {
  console.error("[inventory-v2-demand-seed] Missing DATABASE_URL or DATABASE_URL_UNPOOLED.")
  process.exit(1)
}

const execute = process.env.INVENTORY_V2_TESTDATA_EXECUTE === "true"
const pool = new Pool({ connectionString: databaseUrl })

function nowIso() {
  return new Date().toISOString()
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
      LIMIT 1
    `,
    [tableName]
  )
  return result.rowCount > 0
}

async function getRegionalOfficeId(client, officeNameHint) {
  const hinted = await client.query(
    `
      SELECT id
      FROM "RegionalOffice"
      WHERE LOWER(name) LIKE LOWER($1)
      ORDER BY name ASC
      LIMIT 1
    `,
    [`%${officeNameHint}%`]
  )
  if (hinted.rowCount > 0) return hinted.rows[0].id

  const fallback = await client.query(`SELECT id FROM "RegionalOffice" ORDER BY name ASC LIMIT 1`)
  return fallback.rowCount > 0 ? fallback.rows[0].id : null
}

async function upsertStore(client, store) {
  await client.query(
    `
      INSERT INTO "Store" (
        "id", "code", "name", "type", "prefix", "regionalOfficeId", "isActive", "address", "contactNumber", "createdAt", "updatedAt"
      )
      VALUES (
        concat('st_', md5(random()::text || clock_timestamp()::text)),
        $1, $2, $3, $4, $5, true, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("code") DO UPDATE
      SET "name" = EXCLUDED."name",
          "type" = EXCLUDED."type",
          "prefix" = EXCLUDED."prefix",
          "regionalOfficeId" = EXCLUDED."regionalOfficeId",
          "address" = EXCLUDED."address",
          "contactNumber" = EXCLUDED."contactNumber",
          "isActive" = true,
          "updatedAt" = CURRENT_TIMESTAMP
    `,
    [store.code, store.name, store.type, store.prefix, store.regionalOfficeId, store.address, store.contactNumber]
  )
}

async function upsertNamedMaster(client, tableName, name, extra = {}) {
  const columns = Object.keys(extra)
  const values = Object.values(extra)
  const columnSql = columns.length ? `, ${columns.map((c) => `"${c}"`).join(", ")}` : ""
  const valueSql = columns.length ? `, ${columns.map((_, i) => `$${i + 2}`).join(", ")}` : ""
  const updateSql = columns.length ? `, ${columns.map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ")}` : ""

  await client.query(
    `
      INSERT INTO "${tableName}" ("id", "name"${columnSql}, "createdAt", "updatedAt")
      VALUES (concat(lower($1), '_', md5(random()::text || clock_timestamp()::text)), $1${valueSql}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("name") DO UPDATE
      SET "name" = EXCLUDED."name"${updateSql}, "updatedAt" = CURRENT_TIMESTAMP
    `,
    [name, ...values]
  )
}

async function upsertCategory(client, tableName, category) {
  if (tableName !== "StoreInventoryCategory") {
    await upsertNamedMaster(client, tableName, category.name)
    return
  }

  await client.query(
    `
      INSERT INTO "StoreInventoryCategory" (
        "id", "name", "canAssignGuard", "canAssignEmployee", "canAssignClient", "createdAt", "updatedAt"
      )
      VALUES (
        concat('cat_', md5(random()::text || clock_timestamp()::text)),
        $1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("name") DO UPDATE
      SET "canAssignGuard" = EXCLUDED."canAssignGuard",
          "canAssignEmployee" = EXCLUDED."canAssignEmployee",
          "canAssignClient" = EXCLUDED."canAssignClient",
          "updatedAt" = CURRENT_TIMESTAMP
    `,
    [category.name, category.canAssignGuard, category.canAssignEmployee, category.canAssignClient]
  )
}

async function getIdByName(client, tableName, name) {
  const result = await client.query(`SELECT id FROM "${tableName}" WHERE "name" = $1 LIMIT 1`, [name])
  return result.rowCount > 0 ? result.rows[0].id : null
}

async function upsertProduct(client, product) {
  await client.query(
    `
      INSERT INTO "StoreInventoryProduct" (
        "id", "sku", "name", "description", "serialRequired",
        "brandId", "unitId", "statusId", "conditionId", "categoryId",
        "weaponTypeId", "calibreId", "licenseTypeId", "variationId",
        "createdAt", "updatedAt"
      )
      VALUES (
        concat('sip_', md5(random()::text || clock_timestamp()::text)),
        $1, $2, $3, $4,
        $5, $6, $7, $8, $9,
        $10, $11, $12, $13,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("sku") DO UPDATE
      SET "name" = EXCLUDED."name",
          "description" = EXCLUDED."description",
          "serialRequired" = EXCLUDED."serialRequired",
          "brandId" = EXCLUDED."brandId",
          "unitId" = EXCLUDED."unitId",
          "statusId" = EXCLUDED."statusId",
          "conditionId" = EXCLUDED."conditionId",
          "categoryId" = EXCLUDED."categoryId",
          "weaponTypeId" = EXCLUDED."weaponTypeId",
          "calibreId" = EXCLUDED."calibreId",
          "licenseTypeId" = EXCLUDED."licenseTypeId",
          "variationId" = EXCLUDED."variationId",
          "updatedAt" = CURRENT_TIMESTAMP
    `,
    [
      product.sku,
      product.name,
      product.description,
      product.serialRequired,
      product.brandId,
      product.unitId,
      product.statusId,
      product.conditionId,
      product.categoryId,
      product.weaponTypeId,
      product.calibreId,
      product.licenseTypeId,
      product.variationId,
    ]
  )
}

async function getProductIdBySku(client, sku) {
  const result = await client.query(`SELECT id FROM "StoreInventoryProduct" WHERE "sku" = $1 LIMIT 1`, [sku])
  return result.rowCount > 0 ? result.rows[0].id : null
}

async function upsertBalance(client, balance) {
  await client.query(
    `
      INSERT INTO "StoreInventoryBalance" (
        "id", "storeId", "productId", "quantityOnHand", "quantityHeld", "quantityIssued", "avgUnitCost", "updatedAt"
      )
      VALUES (
        concat('sib_', md5(random()::text || clock_timestamp()::text)),
        $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("storeId", "productId") DO UPDATE
      SET "quantityOnHand" = EXCLUDED."quantityOnHand",
          "quantityHeld" = EXCLUDED."quantityHeld",
          "quantityIssued" = EXCLUDED."quantityIssued",
          "avgUnitCost" = EXCLUDED."avgUnitCost",
          "updatedAt" = CURRENT_TIMESTAMP
    `,
    [
      balance.storeId,
      balance.productId,
      balance.quantityOnHand,
      balance.quantityHeld,
      balance.quantityIssued,
      balance.avgUnitCost,
    ]
  )
}

async function main() {
  console.log(`[inventory-v2-demand-seed] Started at ${nowIso()}`)
  console.log(`[inventory-v2-demand-seed] Mode: ${execute ? "execute" : "dry-run"}`)

  const client = await pool.connect()
  try {
    const categoryTable = (await tableExists(client, "StoreInventoryCategory"))
      ? "StoreInventoryCategory"
      : "InventoryCategory"

    const lhrOfficeId = await getRegionalOfficeId(client, "lahore")
    const khiOfficeId = await getRegionalOfficeId(client, "karachi")

    const plan = {
      stores: [
        {
          code: "WH-LHR-CENTRAL",
          name: "Lahore Central Warehouse",
          type: "WAREHOUSE",
          prefix: "LHR",
          regionalOfficeId: lhrOfficeId,
          address: "Lahore Central Warehouse - Test Block",
          contactNumber: "03001000001",
        },
        {
          code: "WH-KHI-CENTRAL",
          name: "Karachi Central Warehouse",
          type: "WAREHOUSE",
          prefix: "KHI",
          regionalOfficeId: khiOfficeId,
          address: "Karachi Central Warehouse - Test Block",
          contactNumber: "03001000002",
        },
        {
          code: "ST-LHR-ALPHA",
          name: "Lahore Alpha Store",
          type: "STORE",
          prefix: "LHA",
          regionalOfficeId: lhrOfficeId,
          address: "Lahore Alpha Store - Test Block",
          contactNumber: "03001000003",
        },
        {
          code: "ST-LHR-BRAVO",
          name: "Lahore Bravo Store",
          type: "STORE",
          prefix: "LHB",
          regionalOfficeId: lhrOfficeId,
          address: "Lahore Bravo Store - Test Block",
          contactNumber: "03001000004",
        },
        {
          code: "ST-KHI-OMEGA",
          name: "Karachi Omega Store",
          type: "STORE",
          prefix: "KHO",
          regionalOfficeId: khiOfficeId,
          address: "Karachi Omega Store - Test Block",
          contactNumber: "03001000005",
        },
      ],
      masters: {
        brands: ["Alpha Tactical", "Parwest Test Brand", "Ops Supply"],
        units: [
          { name: "Piece", shortCode: "PCS" },
          { name: "Set", shortCode: "SET" },
          { name: "Box", shortCode: "BOX" },
        ],
        statuses: ["Active", "Serviceable", "Reserved"],
        conditions: [
          { name: "New", description: "Factory condition" },
          { name: "Good", description: "Operational good" },
          { name: "Refurbished", description: "Repaired and tested" },
        ],
        weaponTypes: ["9MM Pistol", "SMG", "12 Bore Shotgun"],
        calibres: ["9MM", "7.62MM", "12 Bore"],
        licenseTypes: ["Carry License", "Duty License"],
        variations: ["Large / Blue", "XL / Black", "Medium / Olive", "Standard / Grey"],
        categories: [
          { name: "Weapon", canAssignGuard: true, canAssignEmployee: true, canAssignClient: false },
          { name: "Uniform", canAssignGuard: true, canAssignEmployee: true, canAssignClient: true },
          { name: "Accessories", canAssignGuard: true, canAssignEmployee: true, canAssignClient: true },
          { name: "Equipment", canAssignGuard: true, canAssignEmployee: true, canAssignClient: true },
        ],
      },
      products: [
        { sku: "E2E-WPN-9MM-01", name: "E2E Pistol 9MM", category: "Weapon", weaponType: "9MM Pistol", calibre: "9MM", serialRequired: true, avgCost: 78000 },
        { sku: "E2E-WPN-SMG-01", name: "E2E SMG", category: "Weapon", weaponType: "SMG", calibre: "7.62MM", serialRequired: true, avgCost: 145000 },
        { sku: "E2E-WPN-SHT-01", name: "E2E Shotgun", category: "Weapon", weaponType: "12 Bore Shotgun", calibre: "12 Bore", serialRequired: true, avgCost: 92000 },

        { sku: "E2E-UNF-JKT-01", name: "E2E Tactical Jacket", category: "Uniform", variation: "Large / Blue", serialRequired: false, avgCost: 4800 },
        { sku: "E2E-UNF-PNT-01", name: "E2E Uniform Pants", category: "Uniform", variation: "XL / Black", serialRequired: false, avgCost: 2900 },
        { sku: "E2E-UNF-SHT-01", name: "E2E Uniform Shirt", category: "Uniform", variation: "Medium / Olive", serialRequired: false, avgCost: 2200 },

        { sku: "E2E-ACC-BLT-01", name: "E2E Duty Belt", category: "Accessories", variation: "Standard / Grey", serialRequired: false, avgCost: 1100 },
        { sku: "E2E-ACC-HLS-01", name: "E2E Holster", category: "Accessories", variation: "Standard / Grey", serialRequired: false, avgCost: 1900 },
        { sku: "E2E-ACC-CAP-01", name: "E2E Field Cap", category: "Accessories", variation: "Large / Blue", serialRequired: false, avgCost: 850 },

        { sku: "E2E-EQP-RAD-01", name: "E2E Radio Set", category: "Equipment", variation: "Standard / Grey", serialRequired: true, avgCost: 26000 },
        { sku: "E2E-EQP-TOR-01", name: "E2E Tactical Torch", category: "Equipment", variation: "Standard / Grey", serialRequired: false, avgCost: 3500 },
        { sku: "E2E-EQP-MDT-01", name: "E2E Metal Detector", category: "Equipment", variation: "Standard / Grey", serialRequired: false, avgCost: 18500 },
      ],
    }

    console.log("[inventory-v2-demand-seed] Plan summary:")
    console.log(`  - stores: ${plan.stores.length}`)
    console.log(`  - categories: ${plan.masters.categories.length}`)
    console.log(`  - products: ${plan.products.length}`)
    console.log(`  - categoryTable: ${categoryTable}`)

    if (!execute) {
      console.log("[inventory-v2-demand-seed] Dry-run complete. Set INVENTORY_V2_TESTDATA_EXECUTE=true to apply.")
      return
    }

    await client.query("BEGIN")

    for (const store of plan.stores) {
      await upsertStore(client, store)
    }

    for (const brand of plan.masters.brands) {
      await upsertNamedMaster(client, "StoreInventoryBrand", brand)
    }

    for (const unit of plan.masters.units) {
      await upsertNamedMaster(client, "StoreInventoryUnit", unit.name, { shortCode: unit.shortCode })
    }

    for (const status of plan.masters.statuses) {
      await upsertNamedMaster(client, "StoreInventoryStatus", status)
    }

    for (const condition of plan.masters.conditions) {
      await upsertNamedMaster(client, "StoreInventoryConditionV2", condition.name, { description: condition.description })
    }

    for (const weaponType of plan.masters.weaponTypes) {
      await upsertNamedMaster(client, "StoreInventoryWeaponType", weaponType)
    }

    for (const calibre of plan.masters.calibres) {
      await upsertNamedMaster(client, "StoreInventoryCalibre", calibre)
    }

    for (const licenseType of plan.masters.licenseTypes) {
      await upsertNamedMaster(client, "StoreInventoryLicenseType", licenseType)
    }

    for (const variation of plan.masters.variations) {
      await upsertNamedMaster(client, "StoreInventoryVariation", variation)
    }

    for (const category of plan.masters.categories) {
      await upsertCategory(client, categoryTable, category)
    }

    const defaultBrandId = await getIdByName(client, "StoreInventoryBrand", "Parwest Test Brand")
    const defaultUnitId = await getIdByName(client, "StoreInventoryUnit", "Piece")
    const defaultStatusId = await getIdByName(client, "StoreInventoryStatus", "Active")
    const defaultConditionId = await getIdByName(client, "StoreInventoryConditionV2", "New")
    const defaultLicenseTypeId = await getIdByName(client, "StoreInventoryLicenseType", "Duty License")

    const categoryIdByName = {}
    for (const category of plan.masters.categories) {
      categoryIdByName[category.name] = await getIdByName(client, categoryTable, category.name)
    }

    const weaponTypeIdByName = {}
    for (const name of plan.masters.weaponTypes) {
      weaponTypeIdByName[name] = await getIdByName(client, "StoreInventoryWeaponType", name)
    }

    const calibreIdByName = {}
    for (const name of plan.masters.calibres) {
      calibreIdByName[name] = await getIdByName(client, "StoreInventoryCalibre", name)
    }

    const variationIdByName = {}
    for (const name of plan.masters.variations) {
      variationIdByName[name] = await getIdByName(client, "StoreInventoryVariation", name)
    }

    for (const product of plan.products) {
      await upsertProduct(client, {
        sku: product.sku,
        name: product.name,
        description: `Seeded E2E test product: ${product.name}`,
        serialRequired: product.serialRequired,
        brandId: defaultBrandId,
        unitId: defaultUnitId,
        statusId: defaultStatusId,
        conditionId: defaultConditionId,
        categoryId: categoryIdByName[product.category],
        weaponTypeId: product.weaponType ? weaponTypeIdByName[product.weaponType] : null,
        calibreId: product.calibre ? calibreIdByName[product.calibre] : null,
        licenseTypeId: product.category === "Weapon" ? defaultLicenseTypeId : null,
        variationId: product.variation ? variationIdByName[product.variation] : null,
      })
    }

    const storeRows = await client.query(`SELECT id, code, type FROM "Store" WHERE code LIKE 'WH-%' OR code LIKE 'ST-%'`)
    const storeByCode = new Map(storeRows.rows.map((row) => [row.code, row]))

    let seededBalances = 0
    for (const product of plan.products) {
      const productId = await getProductIdBySku(client, product.sku)
      if (!productId) throw new Error(`Product missing after upsert: ${product.sku}`)

      for (const store of plan.stores) {
        const storeRow = storeByCode.get(store.code)
        if (!storeRow) throw new Error(`Store missing after upsert: ${store.code}`)

        const isWarehouse = store.type === "WAREHOUSE"
        const quantityOnHand = isWarehouse ? 250 + seededBalances * 2 : 35 + (seededBalances % 20)
        const quantityIssued = isWarehouse ? 0 : Math.floor((seededBalances % 7) + 1)
        const quantityHeld = isWarehouse ? 0 : Math.floor(seededBalances % 3)

        await upsertBalance(client, {
          storeId: storeRow.id,
          productId,
          quantityOnHand,
          quantityHeld,
          quantityIssued,
          avgUnitCost: product.avgCost,
        })

        seededBalances += 1
      }
    }

    await client.query("COMMIT")

    console.log("[inventory-v2-demand-seed] Seed applied successfully.")
    console.log("[inventory-v2-demand-seed] Added stores, categories, and multiple products per category with balances.")
    console.log("[inventory-v2-demand-seed] Ready for end-to-end demand request/response/transport/receive testing.")
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
  console.error("[inventory-v2-demand-seed] Failed:", error.message)
  process.exit(1)
})

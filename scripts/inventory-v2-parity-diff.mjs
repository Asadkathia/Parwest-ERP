import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import dotenv from "dotenv"
import { Pool } from "pg"

dotenv.config()

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function isMissingRelationError(error) {
  return Boolean(error && typeof error === "object" && error.code === "42P01")
}

function pct(part, whole) {
  if (!whole) return 0
  return Number(((part / whole) * 100).toFixed(2))
}

function nowIso() {
  return new Date().toISOString()
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or DATABASE_URL_UNPOOLED is required.")
  }

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    let legacySummaryRes
    let v2SummaryRes
    let suspiciousBalanceRowsRes
    let suspiciousProductRowsRes
    let suspiciousStoreRowsRes
    let legacyIssuedRowsRes
    let v2IssuedBalanceRowsRes
    let v2ActiveAssignmentsRes

    try {
      ;[
        legacySummaryRes,
        v2SummaryRes,
        suspiciousBalanceRowsRes,
        suspiciousProductRowsRes,
        suspiciousStoreRowsRes,
        legacyIssuedRowsRes,
        v2IssuedBalanceRowsRes,
        v2ActiveAssignmentsRes,
      ] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*)::int AS item_rows,
            COALESCE(SUM(CASE WHEN "isNonUnique" THEN GREATEST(COALESCE(quantity, 1), 1) ELSE 1 END), 0)::int AS unit_total,
            COALESCE(SUM(CASE WHEN status = 'ISSUED' THEN CASE WHEN "isNonUnique" THEN GREATEST(COALESCE(quantity, 1), 1) ELSE 1 END ELSE 0 END), 0)::int AS issued_units
          FROM "InventoryItem"
        `),
        pool.query(`
          SELECT
            COUNT(*)::int AS balance_rows,
            COALESCE(SUM("quantityOnHand"), 0)::int AS on_hand_units,
            COALESCE(SUM("quantityHeld"), 0)::int AS held_units,
            COALESCE(SUM("quantityIssued"), 0)::int AS issued_units
          FROM "StoreInventoryBalance"
        `),
        pool.query(`
          WITH suspicious_products AS (
            SELECT id
            FROM "StoreInventoryProduct"
            WHERE sku ILIKE 'INV2-SKU-%'
               OR sku ILIKE 'IMPORT-%'
               OR name ILIKE 'Inventory V2 Product %'
               OR name ILIKE 'Imported Inventory Product%'
          ),
          suspicious_stores AS (
            SELECT id
            FROM "Store"
            WHERE code ILIKE 'INV2-%'
               OR name ILIKE 'Inventory V2 %'
          )
          SELECT
            b.id,
            b."storeId",
            s.code AS store_code,
            s.name AS store_name,
            b."productId",
            p.sku AS product_sku,
            p.name AS product_name,
            b."quantityOnHand"::int AS on_hand,
            b."quantityHeld"::int AS held,
            b."quantityIssued"::int AS issued,
            (b."quantityOnHand" + b."quantityHeld" + b."quantityIssued")::int AS tracked_units,
            (sp.id IS NOT NULL) AS suspicious_product,
            (ss.id IS NOT NULL) AS suspicious_store
          FROM "StoreInventoryBalance" b
          INNER JOIN "StoreInventoryProduct" p ON p.id = b."productId"
          INNER JOIN "Store" s ON s.id = b."storeId"
          LEFT JOIN suspicious_products sp ON sp.id = p.id
          LEFT JOIN suspicious_stores ss ON ss.id = s.id
          WHERE sp.id IS NOT NULL OR ss.id IS NOT NULL
          ORDER BY tracked_units DESC, s.name ASC, p.name ASC
        `),
        pool.query(`
          SELECT
            id,
            sku,
            name,
            "createdAt"
          FROM "StoreInventoryProduct"
          WHERE sku ILIKE 'INV2-SKU-%'
             OR sku ILIKE 'IMPORT-%'
             OR name ILIKE 'Inventory V2 Product %'
             OR name ILIKE 'Imported Inventory Product%'
          ORDER BY "createdAt" DESC
          LIMIT 200
        `),
        pool.query(`
          SELECT
            id,
            code,
            name,
            "createdAt"
          FROM "Store"
          WHERE code ILIKE 'INV2-%'
             OR name ILIKE 'Inventory V2 %'
          ORDER BY "createdAt" DESC
          LIMIT 200
        `),
        pool.query(`
          SELECT
            ii.id,
            ii."uniqueNumber",
            ii.status,
            ii."isNonUnique",
            ii.quantity,
            ii."regionalOfficeId",
            ro.name AS office_name
          FROM "InventoryItem" ii
          LEFT JOIN "RegionalOffice" ro ON ro.id = ii."regionalOfficeId"
          WHERE ii.status = 'ISSUED'
          ORDER BY ii."updatedAt" DESC
          LIMIT 200
        `),
        pool.query(`
          SELECT
            b.id,
            b."storeId",
            s.code AS store_code,
            s.name AS store_name,
            b."productId",
            p.sku AS product_sku,
            p.name AS product_name,
            b."quantityIssued"::int AS issued_units
          FROM "StoreInventoryBalance" b
          INNER JOIN "Store" s ON s.id = b."storeId"
          INNER JOIN "StoreInventoryProduct" p ON p.id = b."productId"
          WHERE b."quantityIssued" > 0
          ORDER BY b."quantityIssued" DESC
          LIMIT 200
        `),
        pool.query(`
          SELECT
            a."storeId",
            s.code AS store_code,
            s.name AS store_name,
            a."productId",
            p.sku AS product_sku,
            p.name AS product_name,
            SUM(a.quantity)::int AS assigned_units,
            COUNT(*)::int AS active_assignment_rows
          FROM "StoreInventoryAssignment" a
          INNER JOIN "Store" s ON s.id = a."storeId"
          INNER JOIN "StoreInventoryProduct" p ON p.id = a."productId"
          WHERE a.status = 'ASSIGNED' AND a."returnedAt" IS NULL
          GROUP BY a."storeId", s.code, s.name, a."productId", p.sku, p.name
          ORDER BY assigned_units DESC
          LIMIT 200
        `),
      ])
    } catch (error) {
      if (!isMissingRelationError(error)) throw error
      const out = {
        generatedAt: nowIso(),
        status: "blocked",
        reason: `Missing relation: ${error.message}`,
      }
      const outPath = path.resolve(process.cwd(), "docs/inventory-v2-parity-diff.json")
      await fs.writeFile(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8")
      console.log(`[inventory-v2-parity-diff] BLOCKED: ${out.reason}`)
      console.log(`[inventory-v2-parity-diff] Wrote ${outPath}`)
      return
    }

    const legacy = legacySummaryRes.rows[0] || {}
    const v2 = v2SummaryRes.rows[0] || {}

    const legacyUnits = toNumber(legacy.unit_total)
    const legacyIssued = toNumber(legacy.issued_units)
    const v2Tracked = toNumber(v2.on_hand_units) + toNumber(v2.held_units) + toNumber(v2.issued_units)
    const v2Issued = toNumber(v2.issued_units)

    const suspiciousRows = suspiciousBalanceRowsRes.rows
    const suspiciousTrackedUnits = suspiciousRows.reduce((sum, row) => sum + toNumber(row.tracked_units), 0)
    const suspiciousIssuedUnits = suspiciousRows.reduce((sum, row) => sum + toNumber(row.issued), 0)

    const adjustedTracked = Math.max(v2Tracked - suspiciousTrackedUnits, 0)
    const adjustedUnitDriftAbs = Math.abs(legacyUnits - adjustedTracked)
    const adjustedUnitDriftPct = pct(adjustedUnitDriftAbs, legacyUnits)

    const report = {
      generatedAt: nowIso(),
      summary: {
        legacyUnits,
        legacyIssued,
        v2Tracked,
        v2Issued,
        unitDriftAbs: Math.abs(legacyUnits - v2Tracked),
        unitDriftPct: pct(Math.abs(legacyUnits - v2Tracked), legacyUnits),
        issuedDriftAbs: Math.abs(legacyIssued - v2Issued),
        issuedDriftPct: pct(Math.abs(legacyIssued - v2Issued), legacyIssued || 1),
      },
      suspiciousContributors: {
        suspiciousBalanceRows: suspiciousRows.length,
        suspiciousTrackedUnits,
        suspiciousIssuedUnits,
        adjustedTracked,
        adjustedUnitDriftAbs,
        adjustedUnitDriftPct,
      },
      suspiciousProducts: suspiciousProductRowsRes.rows,
      suspiciousStores: suspiciousStoreRowsRes.rows,
      suspiciousBalances: suspiciousRows,
      legacyIssuedRows: legacyIssuedRowsRes.rows,
      v2IssuedBalanceRows: v2IssuedBalanceRowsRes.rows,
      v2ActiveAssignments: v2ActiveAssignmentsRes.rows,
      candidateCleanupSql: {
        note: "Review before execution. Intended for non-production cleanup of strict-test generated v2 rows.",
        sql: [
          "BEGIN;",
          "DELETE FROM \"StoreInventoryMovement\" m USING \"StoreInventoryProduct\" p WHERE m.\"productId\" = p.id AND (p.sku ILIKE 'INV2-SKU-%' OR p.name ILIKE 'Inventory V2 Product %' OR p.sku ILIKE 'IMPORT-%' OR p.name ILIKE 'Imported Inventory Product%');",
          "DELETE FROM \"StoreInventoryAssignment\" a USING \"StoreInventoryProduct\" p WHERE a.\"productId\" = p.id AND (p.sku ILIKE 'INV2-SKU-%' OR p.name ILIKE 'Inventory V2 Product %' OR p.sku ILIKE 'IMPORT-%' OR p.name ILIKE 'Imported Inventory Product%');",
          "DELETE FROM \"StoreInventoryDemandResponseLine\" drl USING \"StoreInventoryProduct\" p WHERE drl.\"productId\" = p.id AND (p.sku ILIKE 'INV2-SKU-%' OR p.name ILIKE 'Inventory V2 Product %' OR p.sku ILIKE 'IMPORT-%' OR p.name ILIKE 'Imported Inventory Product%');",
          "DELETE FROM \"StoreInventoryDemandLine\" dl USING \"StoreInventoryProduct\" p WHERE dl.\"productId\" = p.id AND (p.sku ILIKE 'INV2-SKU-%' OR p.name ILIKE 'Inventory V2 Product %' OR p.sku ILIKE 'IMPORT-%' OR p.name ILIKE 'Imported Inventory Product%');",
          "DELETE FROM \"StoreInventoryAdjustmentLine\" al USING \"StoreInventoryProduct\" p WHERE al.\"productId\" = p.id AND (p.sku ILIKE 'INV2-SKU-%' OR p.name ILIKE 'Inventory V2 Product %' OR p.sku ILIKE 'IMPORT-%' OR p.name ILIKE 'Imported Inventory Product%');",
          "DELETE FROM \"StoreInventoryPurchaseLine\" pl USING \"StoreInventoryProduct\" p WHERE pl.\"productId\" = p.id AND (p.sku ILIKE 'INV2-SKU-%' OR p.name ILIKE 'Inventory V2 Product %' OR p.sku ILIKE 'IMPORT-%' OR p.name ILIKE 'Imported Inventory Product%');",
          "DELETE FROM \"StoreInventoryBalance\" b USING \"StoreInventoryProduct\" p WHERE b.\"productId\" = p.id AND (p.sku ILIKE 'INV2-SKU-%' OR p.name ILIKE 'Inventory V2 Product %' OR p.sku ILIKE 'IMPORT-%' OR p.name ILIKE 'Imported Inventory Product%');",
          "DELETE FROM \"StoreInventoryProduct\" p WHERE (p.sku ILIKE 'INV2-SKU-%' OR p.name ILIKE 'Inventory V2 Product %' OR p.sku ILIKE 'IMPORT-%' OR p.name ILIKE 'Imported Inventory Product%');",
          "DELETE FROM \"Store\" s WHERE (s.code ILIKE 'INV2-%' OR s.name ILIKE 'Inventory V2 %');",
          "COMMIT;",
        ],
      },
    }

    const docsDir = path.resolve(process.cwd(), "docs")
    const jsonPath = path.join(docsDir, "inventory-v2-parity-diff.json")
    const mdPath = path.join(docsDir, "inventory-v2-parity-diff.md")

    const md = [
      "# Inventory V2 Parity Diff Report",
      "",
      `Generated: ${report.generatedAt}`,
      "",
      "## Summary",
      `- Legacy units: ${report.summary.legacyUnits}`,
      `- V2 tracked units: ${report.summary.v2Tracked}`,
      `- Unit drift: ${report.summary.unitDriftAbs} (${report.summary.unitDriftPct}%)`,
      `- Legacy issued: ${report.summary.legacyIssued}`,
      `- V2 issued: ${report.summary.v2Issued}`,
      `- Issued drift: ${report.summary.issuedDriftAbs} (${report.summary.issuedDriftPct}%)`,
      "",
      "## Suspicious Contributors",
      `- Suspicious balance rows: ${report.suspiciousContributors.suspiciousBalanceRows}`,
      `- Suspicious tracked units: ${report.suspiciousContributors.suspiciousTrackedUnits}`,
      `- Suspicious issued units: ${report.suspiciousContributors.suspiciousIssuedUnits}`,
      `- Adjusted tracked units (if suspicious removed): ${report.suspiciousContributors.adjustedTracked}`,
      `- Adjusted unit drift: ${report.suspiciousContributors.adjustedUnitDriftAbs} (${report.suspiciousContributors.adjustedUnitDriftPct}%)`,
      "",
      "## Candidate Cleanup SQL",
      "Review before execution. Intended for non-production strict-test data cleanup.",
      "",
      "```sql",
      ...report.candidateCleanupSql.sql,
      "```",
      "",
    ].join("\n")

    await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
    await fs.writeFile(mdPath, `${md}\n`, "utf8")

    console.log(`[inventory-v2-parity-diff] Generated: ${report.generatedAt}`)
    console.log(`[inventory-v2-parity-diff] Legacy units: ${report.summary.legacyUnits}`)
    console.log(`[inventory-v2-parity-diff] V2 tracked units: ${report.summary.v2Tracked}`)
    console.log(`[inventory-v2-parity-diff] Unit drift: ${report.summary.unitDriftAbs} (${report.summary.unitDriftPct}%)`)
    console.log(`[inventory-v2-parity-diff] Suspicious tracked units: ${report.suspiciousContributors.suspiciousTrackedUnits}`)
    console.log(`[inventory-v2-parity-diff] Adjusted unit drift: ${report.suspiciousContributors.adjustedUnitDriftAbs} (${report.suspiciousContributors.adjustedUnitDriftPct}%)`)
    console.log(`[inventory-v2-parity-diff] Wrote ${jsonPath}`)
    console.log(`[inventory-v2-parity-diff] Wrote ${mdPath}`)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error("[inventory-v2-parity-diff] Failed:", error.message)
  process.exit(1)
})

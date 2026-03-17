import fs from "node:fs/promises"
import path from "node:path"
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

function formatTs(date = new Date()) {
  return date.toISOString()
}

function mdSection(title, lines) {
  return [`## ${title}`, ...lines, ""].join("\n")
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or DATABASE_URL_UNPOOLED is required.")
  }

  const writeReport = envBool("WRITE_INVENTORY_V2_PARITY_REPORT", true)
  const failOnDrift = envBool("INVENTORY_V2_PARITY_FAIL_ON_DRIFT", false)
  const maxDriftPct = toNumber(process.env.INVENTORY_V2_PARITY_MAX_DRIFT_PCT, 35)

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    let legacySummaryRes
    let legacyByOfficeRes
    let v2SummaryRes
    let v2ByOfficeRes

    try {
      ;[legacySummaryRes, legacyByOfficeRes, v2SummaryRes, v2ByOfficeRes] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*)::int AS item_rows,
            COALESCE(SUM(CASE WHEN "isNonUnique" THEN GREATEST(COALESCE(quantity, 1), 1) ELSE 1 END), 0)::int AS unit_total,
            COALESCE(SUM(CASE WHEN status = 'AVAILABLE' THEN CASE WHEN "isNonUnique" THEN GREATEST(COALESCE(quantity, 1), 1) ELSE 1 END ELSE 0 END), 0)::int AS available_units,
            COALESCE(SUM(CASE WHEN status = 'ISSUED' THEN CASE WHEN "isNonUnique" THEN GREATEST(COALESCE(quantity, 1), 1) ELSE 1 END ELSE 0 END), 0)::int AS issued_units,
            COALESCE(SUM(CASE WHEN status = 'CONDEMNED' THEN CASE WHEN "isNonUnique" THEN GREATEST(COALESCE(quantity, 1), 1) ELSE 1 END ELSE 0 END), 0)::int AS condemned_units
          FROM "InventoryItem"
        `),
        pool.query(`
          SELECT
            COALESCE(ro.id, 'UNASSIGNED') AS office_id,
            COALESCE(ro.name, 'Unassigned') AS office_name,
            COALESCE(SUM(CASE WHEN ii."isNonUnique" THEN GREATEST(COALESCE(ii.quantity, 1), 1) ELSE 1 END), 0)::int AS legacy_units
          FROM "InventoryItem" ii
          LEFT JOIN "RegionalOffice" ro ON ro.id = ii."regionalOfficeId"
          GROUP BY COALESCE(ro.id, 'UNASSIGNED'), COALESCE(ro.name, 'Unassigned')
          ORDER BY office_name ASC
        `),
        pool.query(`
          SELECT
            COUNT(DISTINCT sib."productId")::int AS product_count,
            COUNT(*)::int AS balance_rows,
            COALESCE(SUM(sib."quantityOnHand"), 0)::int AS on_hand_units,
            COALESCE(SUM(sib."quantityHeld"), 0)::int AS held_units,
            COALESCE(SUM(sib."quantityIssued"), 0)::int AS issued_units,
            COALESCE(SUM(COALESCE(sib."avgUnitCost", 0) * sib."quantityOnHand"), 0)::numeric(16,2) AS inventory_value
          FROM "StoreInventoryBalance" sib
        `),
        pool.query(`
          SELECT
            COALESCE(ro.id, 'UNASSIGNED') AS office_id,
            COALESCE(ro.name, 'Unassigned') AS office_name,
            COALESCE(SUM(sib."quantityOnHand"), 0)::int AS on_hand_units,
            COALESCE(SUM(sib."quantityIssued"), 0)::int AS issued_units,
            COALESCE(SUM(sib."quantityHeld"), 0)::int AS held_units
          FROM "StoreInventoryBalance" sib
          INNER JOIN "Store" s ON s.id = sib."storeId"
          LEFT JOIN "RegionalOffice" ro ON ro.id = s."regionalOfficeId"
          GROUP BY COALESCE(ro.id, 'UNASSIGNED'), COALESCE(ro.name, 'Unassigned')
          ORDER BY office_name ASC
        `),
      ])
    } catch (error) {
      if (!isMissingRelationError(error)) throw error

      const blockedReport = {
        generatedAt: formatTs(),
        status: "blocked",
        reason: `Missing relation: ${error.message}`,
        thresholds: {
          failOnDrift,
          maxDriftPct,
        },
      }

      console.log(`[inventory-v2-parity] BLOCKED: ${blockedReport.reason}`)

      if (writeReport) {
        const docsDir = path.resolve(process.cwd(), "docs")
        const jsonPath = path.join(docsDir, "inventory-v2-parity-report.json")
        const mdPath = path.join(docsDir, "inventory-v2-parity-report.md")
        await fs.writeFile(jsonPath, `${JSON.stringify(blockedReport, null, 2)}\n`, "utf8")
        await fs.writeFile(
          mdPath,
          `# Inventory V2 Parity Report\n\nGenerated: ${blockedReport.generatedAt}\n\nStatus: **blocked**\n\nReason: ${blockedReport.reason}\n`,
          "utf8"
        )
        console.log(`[inventory-v2-parity] Wrote ${jsonPath}`)
        console.log(`[inventory-v2-parity] Wrote ${mdPath}`)
      }

      return
    }

    const legacy = legacySummaryRes.rows[0] || {}
    const v2 = v2SummaryRes.rows[0] || {}

    const legacyUnitTotal = toNumber(legacy.unit_total)
    const v2TrackedUnits = toNumber(v2.on_hand_units) + toNumber(v2.held_units) + toNumber(v2.issued_units)
    const unitDriftAbs = Math.abs(legacyUnitTotal - v2TrackedUnits)
    const unitDriftPct = pct(unitDriftAbs, legacyUnitTotal)

    const legacyIssued = toNumber(legacy.issued_units)
    const v2Issued = toNumber(v2.issued_units)
    const issuedDriftAbs = Math.abs(legacyIssued - v2Issued)
    const issuedDriftPct = pct(issuedDriftAbs, legacyIssued || 1)

    const report = {
      generatedAt: formatTs(),
      thresholds: {
        failOnDrift,
        maxDriftPct,
      },
      legacy: {
        itemRows: toNumber(legacy.item_rows),
        unitTotal: legacyUnitTotal,
        availableUnits: toNumber(legacy.available_units),
        issuedUnits: legacyIssued,
        condemnedUnits: toNumber(legacy.condemned_units),
      },
      v2: {
        productCount: toNumber(v2.product_count),
        balanceRows: toNumber(v2.balance_rows),
        onHandUnits: toNumber(v2.on_hand_units),
        heldUnits: toNumber(v2.held_units),
        issuedUnits: v2Issued,
        trackedUnits: v2TrackedUnits,
        inventoryValue: Number(v2.inventory_value ?? 0),
      },
      parity: {
        unitDriftAbs,
        unitDriftPct,
        issuedDriftAbs,
        issuedDriftPct,
      },
      byOffice: {
        legacy: legacyByOfficeRes.rows,
        v2: v2ByOfficeRes.rows,
      },
    }

    const summaryLines = [
      `[inventory-v2-parity] Generated: ${report.generatedAt}`,
      `[inventory-v2-parity] Legacy units: ${report.legacy.unitTotal}`,
      `[inventory-v2-parity] V2 tracked units: ${report.v2.trackedUnits}`,
      `[inventory-v2-parity] Unit drift: ${report.parity.unitDriftAbs} (${report.parity.unitDriftPct}%)`,
      `[inventory-v2-parity] Legacy issued: ${report.legacy.issuedUnits}`,
      `[inventory-v2-parity] V2 issued: ${report.v2.issuedUnits}`,
      `[inventory-v2-parity] Issued drift: ${report.parity.issuedDriftAbs} (${report.parity.issuedDriftPct}%)`,
      `[inventory-v2-parity] V2 inventory value: ${report.v2.inventoryValue}`,
    ]

    for (const line of summaryLines) console.log(line)

    if (writeReport) {
      const docsDir = path.resolve(process.cwd(), "docs")
      const jsonPath = path.join(docsDir, "inventory-v2-parity-report.json")
      const mdPath = path.join(docsDir, "inventory-v2-parity-report.md")

      const md = [
        "# Inventory V2 Parity Report",
        "",
        `Generated: ${report.generatedAt}`,
        "",
        mdSection("Legacy Summary", [
          `- Item rows: ${report.legacy.itemRows}`,
          `- Unit total: ${report.legacy.unitTotal}`,
          `- Available units: ${report.legacy.availableUnits}`,
          `- Issued units: ${report.legacy.issuedUnits}`,
          `- Condemned units: ${report.legacy.condemnedUnits}`,
        ]),
        mdSection("V2 Summary", [
          `- Product count: ${report.v2.productCount}`,
          `- Balance rows: ${report.v2.balanceRows}`,
          `- On-hand units: ${report.v2.onHandUnits}`,
          `- Held units: ${report.v2.heldUnits}`,
          `- Issued units: ${report.v2.issuedUnits}`,
          `- Tracked units: ${report.v2.trackedUnits}`,
          `- Inventory value: ${report.v2.inventoryValue}`,
        ]),
        mdSection("Parity", [
          `- Unit drift: ${report.parity.unitDriftAbs} (${report.parity.unitDriftPct}%)`,
          `- Issued drift: ${report.parity.issuedDriftAbs} (${report.parity.issuedDriftPct}%)`,
          `- Threshold: ${report.thresholds.maxDriftPct}%`,
          `- Fail on drift: ${report.thresholds.failOnDrift}`,
        ]),
      ].join("\n")

      await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
      await fs.writeFile(mdPath, `${md}\n`, "utf8")
      console.log(`[inventory-v2-parity] Wrote ${jsonPath}`)
      console.log(`[inventory-v2-parity] Wrote ${mdPath}`)
    }

    if (failOnDrift && report.parity.unitDriftPct > maxDriftPct) {
      throw new Error(
        `Unit drift ${report.parity.unitDriftPct}% exceeds configured threshold ${maxDriftPct}%`
      )
    }
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error("[inventory-v2-parity] Failed:", error.message)
  process.exit(1)
})

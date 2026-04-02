import "dotenv/config"
import fs from "node:fs/promises"
import path from "node:path"
import { Pool } from "pg"

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING

if (!databaseUrl) {
  console.error("[db-dump] Missing DATABASE_URL (or compatible Postgres env).")
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl })

function tsForFile() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")
}

async function main() {
  const client = await pool.connect()
  try {
    console.log("[db-dump] Discovering tables...")
    const tablesResult = await client.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name ASC
      `
    )

    const tableNames = tablesResult.rows.map((row) => row.table_name)
    console.log(`[db-dump] Found ${tableNames.length} tables.`)

    const dump = {
      generatedAt: new Date().toISOString(),
      databaseHost: new URL(databaseUrl).hostname,
      tableCount: tableNames.length,
      tables: {},
      counts: {},
    }

    for (const tableName of tableNames) {
      const rowsResult = await client.query(`SELECT * FROM "${tableName}"`)
      dump.tables[tableName] = rowsResult.rows
      dump.counts[tableName] = rowsResult.rowCount
      console.log(`[db-dump] ${tableName}: ${rowsResult.rowCount}`)
    }

    const filePath = path.join(process.cwd(), "docs", `db-records-full-${tsForFile()}.json`)
    await fs.writeFile(filePath, JSON.stringify(dump, null, 2), "utf-8")
    console.log(`[db-dump] Wrote ${filePath}`)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error("[db-dump] Failed:", error.message)
  process.exit(1)
})


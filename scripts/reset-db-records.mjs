import "dotenv/config"
import { Pool } from "pg"

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING

if (!databaseUrl) {
  console.error("[db-reset] Missing DATABASE_URL (or compatible Postgres env).")
  process.exit(1)
}

const execute = process.env.CLEAR_ALL_DB_EXECUTE === "true"
const pool = new Pool({ connectionString: databaseUrl })

async function main() {
  const client = await pool.connect()
  try {
    const tablesResult = await client.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name <> '_prisma_migrations'
        ORDER BY table_name ASC
      `
    )

    const tables = tablesResult.rows.map((row) => row.table_name)
    console.log(`[db-reset] Mode: ${execute ? "execute" : "dry-run"}`)
    console.log(`[db-reset] Target tables: ${tables.length}`)

    if (tables.length === 0) {
      console.log("[db-reset] No tables found to clear.")
      return
    }

    for (const table of tables) {
      const countResult = await client.query(`SELECT COUNT(*)::int AS count FROM "${table}"`)
      console.log(`  - ${table}: ${countResult.rows[0].count}`)
    }

    if (!execute) {
      console.log("[db-reset] Dry-run complete. Set CLEAR_ALL_DB_EXECUTE=true to truncate all records.")
      return
    }

    await client.query("BEGIN")
    await client.query(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`)
    await client.query("COMMIT")
    console.log("[db-reset] All non-migration table records cleared successfully.")
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
  console.error("[db-reset] Failed:", error.message)
  process.exit(1)
})


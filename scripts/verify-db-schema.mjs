import "dotenv/config"
import { Pool } from "pg"

const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

if (!databaseUrl) {
  console.log("Skipping DB schema verification: no database URL configured.")
  process.exit(0)
}

const requiredTables = (process.env.REQUIRED_DB_TABLES ??
  "User,Role,Guard,Client,Branch,Deployment,Requisition").split(",")
  .map((name) => name.trim())
  .filter(Boolean)

if (requiredTables.length === 0) {
  console.log("Skipping DB schema verification: no required tables configured.")
  process.exit(0)
}

const pool = new Pool({ connectionString: databaseUrl })

try {
  const result = await pool.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
    `,
    [requiredTables]
  )

  const existing = new Set(result.rows.map((row) => row.table_name))
  const missing = requiredTables.filter((tableName) => !existing.has(tableName))

  if (missing.length > 0) {
    console.error("DB schema verification failed.")
    console.error(`Missing required table(s): ${missing.join(", ")}`)
    console.error(
      "Ensure Vercel is connected to the correct DATABASE_URL and that Prisma migrations have been applied."
    )
    process.exit(1)
  }

  console.log("DB schema verification passed.")
  console.log(`Verified table(s): ${requiredTables.join(", ")}`)
} finally {
  await pool.end()
}

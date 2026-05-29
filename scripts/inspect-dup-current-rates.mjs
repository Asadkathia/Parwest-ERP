// READ-ONLY diagnostic: how many ClientContractRate "current" rows would the
// 20260529 migration's defensive demotion UPDATE touch? SELECT only — no writes.
import fs from "fs"
import pg from "pg"

const envText = fs.readFileSync(".env", "utf8")
const lines = envText.split("\n").filter((l) => l.startsWith("DATABASE_URL="))
if (!lines.length) {
  console.error("No DATABASE_URL in .env")
  process.exit(1)
}
let raw = lines[lines.length - 1].slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "")

// Mirror src/lib/db.ts exactly: pass the connection string unchanged (it carries
// sslmode=verify-full&channel_binding=require) and let pg negotiate secure TLS.
// No ssl override — full certificate verification is preserved.
const client = new pg.Client({ connectionString: raw, connectionTimeoutMillis: 20000, query_timeout: 20000 })

const COMBO = `"contractId", COALESCE(province,''), COALESCE(city,''), "guardType", COALESCE("exService",'')`

try {
  await client.connect()
  const out = {}
  out.total_rows = (await client.query(`SELECT COUNT(*)::int n FROM "ClientContractRate"`)).rows[0].n
  out.total_current = (await client.query(`SELECT COUNT(*)::int n FROM "ClientContractRate" WHERE "isCurrentRate" = true`)).rows[0].n
  out.affected_combos = (await client.query(
    `SELECT COUNT(*)::int n FROM (SELECT 1 FROM "ClientContractRate" WHERE "isCurrentRate" = true GROUP BY ${COMBO} HAVING COUNT(*) > 1) t`
  )).rows[0].n
  out.rows_to_demote = (await client.query(
    `WITH ranked AS (SELECT ROW_NUMBER() OVER (PARTITION BY ${COMBO} ORDER BY "updatedAt" DESC, "createdAt" DESC) rn FROM "ClientContractRate" WHERE "isCurrentRate" = true) SELECT COUNT(*)::int n FROM ranked WHERE rn > 1`
  )).rows[0].n
  // Sample a few affected combos for visibility (no PII; ids + rate counts only)
  out.sample = (await client.query(
    `SELECT "contractId", province, city, "guardType", "exService", COUNT(*)::int dup_count FROM "ClientContractRate" WHERE "isCurrentRate" = true GROUP BY ${COMBO}, province, city, "exService" HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC LIMIT 10`
  )).rows
  console.log(JSON.stringify(out, null, 2))
} catch (e) {
  console.error("QUERY FAILED:", e.message)
  process.exit(2)
} finally {
  await client.end()
}

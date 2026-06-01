// Validate migration 122000 against prod INSIDE a transaction, then ROLLBACK —
// proves the SQL applies cleanly without persisting anything (no column drop).
import fs from "fs"
import pg from "pg"
const raw = fs.readFileSync(".env","utf8").split("\n").filter(l=>l.startsWith("DATABASE_URL=")).pop().slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g,"")
const sql = fs.readFileSync("prisma/migrations/20260530122000_contract_rate_scope_constraints/migration.sql","utf8")
const c = new pg.Client({ connectionString: raw, connectionTimeoutMillis: 20000, query_timeout: 30000 })
try {
  await c.connect()
  await c.query("BEGIN")
  try {
    await c.query(sql)
    console.log("✅ 122000 applied cleanly inside the transaction (no error).")
    // sanity: the 4 partial indexes exist within the txn
    const idx = await c.query(`SELECT indexname FROM pg_indexes WHERE tablename='ClientContractRate' AND indexname LIKE 'ClientContractRate_current_%_key' ORDER BY indexname`)
    console.log("   indexes created:", idx.rows.map(r=>r.indexname).join(", "))
  } finally {
    await c.query("ROLLBACK")
    console.log("↩️  rolled back — prod unchanged.")
  }
} catch (e) {
  console.error("❌ 122000 FAILED:", e.message)
  process.exit(2)
} finally {
  await c.end()
}

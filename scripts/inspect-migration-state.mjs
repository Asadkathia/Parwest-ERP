// READ-ONLY: verify the true post-failure DB state.
import fs from "fs"
import pg from "pg"
const raw = fs.readFileSync(".env","utf8").split("\n").filter(l=>l.startsWith("DATABASE_URL=")).pop().slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g,"")
const c = new pg.Client({ connectionString: raw, connectionTimeoutMillis: 20000, query_timeout: 20000 })
const q = async (label, sql) => { try { const r = await c.query(sql); console.log(label+":", JSON.stringify(r.rows)) } catch(e){ console.log(label+": ERR "+e.message) } }
try {
  await c.connect()
  await q("_prisma_migrations (120000/121000/122000)",
    `SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back, applied_steps_count
     FROM "_prisma_migrations" WHERE migration_name LIKE '202605301%' ORDER BY migration_name`)
  await q("Region.province exists?",
    `SELECT count(*) FILTER (WHERE column_name='province')::int AS has_province FROM information_schema.columns WHERE table_name='Region'`)
  await q("Region province populated",
    `SELECT count(*)::int total, count(province)::int with_province FROM "Region"`)
  await q("ClientContract.billingMode exists?",
    `SELECT count(*) FILTER (WHERE column_name='billingMode')::int AS has_billingmode FROM information_schema.columns WHERE table_name='ClientContract'`)
  await q("ContractGuardRate table exists?",
    `SELECT to_regclass('public."ContractGuardRate"') IS NOT NULL AS exists`)
  await q("ClientContractRate scope cols + legacy cols",
    `SELECT
       count(*) FILTER (WHERE column_name='scopeLevel')::int AS has_scopelevel,
       count(*) FILTER (WHERE column_name='province')::int AS has_province,
       count(*) FILTER (WHERE column_name='city')::int AS has_city
     FROM information_schema.columns WHERE table_name='ClientContractRate'`)
  await q("ClientContractRate scopeLevel distribution",
    `SELECT COALESCE("scopeLevel"::text,'(NULL)') AS lvl, count(*)::int FROM "ClientContractRate" GROUP BY 1 ORDER BY 1`)
} catch(e){ console.error("FAILED:", e.message); process.exit(2) } finally { await c.end() }

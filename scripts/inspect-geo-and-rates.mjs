// READ-ONLY: list Region names (for province backfill reconciliation) + existing
// ClientContractRate rows (for the scope data-migration). SELECT only.
import fs from "fs"
import pg from "pg"

const envText = fs.readFileSync(".env", "utf8")
const line = envText.split("\n").filter((l) => l.startsWith("DATABASE_URL=")).pop()
const raw = line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "")
const client = new pg.Client({ connectionString: raw, connectionTimeoutMillis: 20000, query_timeout: 20000 })

try {
  await client.connect()
  const regions = (await client.query(`SELECT id, name FROM "Region" ORDER BY name`)).rows
  console.log("REGIONS (" + regions.length + "):")
  for (const r of regions) console.log("  " + r.name)

  const rates = (await client.query(
    `SELECT r.id, r.province, r.city, c."branchId" AS contract_branch
     FROM "ClientContractRate" r JOIN "ClientContract" c ON c.id=r."contractId"`,
  )).rows
  console.log("\nCLIENT_CONTRACT_RATES (" + rates.length + "):")
  for (const r of rates) console.log("  province=" + JSON.stringify(r.province) + " city=" + JSON.stringify(r.city) + " branchContract=" + (r.contract_branch ? "yes" : "no"))

  const offices = (await client.query(`SELECT COUNT(*)::int n FROM "RegionalOffice"`)).rows[0].n
  console.log("\nRegionalOffice count: " + offices)
} catch (e) {
  console.error("FAILED:", e.message)
  process.exit(2)
} finally {
  await client.end()
}

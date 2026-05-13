// Minimal headless check that the team's Guard_Basic_Details.xlsx headers
// exactly match what the guards bulk-import definition declares.
//
// We can't easily run the full engine in a Node CLI (the import graph
// reaches into Next.js + Prisma), so this script just compares the
// header set against a copy of the declared headers/aliases.
//
// Usage: node --experimental-strip-types scripts/verify-guards-import.ts <xlsx>

import fs from "node:fs"
import ExcelJS from "exceljs"

// Mirror of guards.ts REQUIRED_HEADERS + OPTIONAL_HEADERS + HEADER_ALIASES keys.
// Kept inline because the script must not import @/ aliased modules.
const REQUIRED = ["name", "cnic"]
const OPTIONAL = [
  "parwest id", "regional office", "father name", "mother name", "date of birth",
  "cnic issue date", "cnic expiry date", "next of kin", "contact no",
  "passport no", "passport expiry date", "religion", "sect", "cast",
  "designation", "salary", "police station", "blood group", "ex service",
  "other", "registration no", "rank", "group", "service period",
  "service years", "service months", "date of enrolment", "date of discharge",
  "remarks", "current address", "current address number", "permanent address",
  "permanent address number", "education level", "education passing year",
  "education name of institution", "introducer name", "introducer cnic",
  "introducer number", "introducer address", "height", "weight", "eye color",
  "hair color", "disability", "mark of identification", "current status",
  "termination date",
  "first employment company", "first employment start date", "first employment end date",
  "second employment company", "second employment start date", "second employment end date",
  "third employment company", "third employment start date", "third employment end date",
  "first nearest relative", "first nearest relative father name", "first nearest relative relation",
  "first nearest relative cnic number", "first nearest relative cnic issue date",
  "first nearest relative profession", "first nearest relative contact number",
  "first nearest relative address",
  "second nearest relative", "second nearest relative father name", "second nearest relative relation",
  "second nearest relative cnic number", "second nearest relative cnic issue date",
  "second nearest relative profession", "second nearest relative contact number",
  "second nearest relative address",
  "third nearest relative", "third nearest relative father name", "third nearest relative relation",
  "third nearest relative cnic number", "third nearest relative cnic issue date",
  "third nearest relative profession", "third nearest relative contact number",
  "third nearest relative address",
  "first family name", "first family relation", "first family age",
  "first family profession", "first family address",
  "second family name", "second family relation", "second family age",
  "second family profession", "second family address",
  "third family name", "third family relation", "third family age",
  "third family profession", "third family address",
  "first judicial case no", "first judicial case date", "first judicial case police station",
  "first judicial case investigation result", "first judicial case court result",
  "second judicial case no", "second judicial case date", "second judicial case police station",
  "second judicial case investigation result", "second judicial case court result",
  "third judicial case no", "third judicial case date", "third judicial case police station",
  "third judicial case investigation result", "third judicial case court result",
  "marital_status",
]

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error("Usage: verify-guards-import.ts <path-to-xlsx>")
    process.exit(1)
  }
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(file)
  const ws = wb.worksheets[0]
  const headerRow = ws.getRow(1)
  const headers: string[] = []
  headerRow.eachCell({ includeEmpty: false }, (cell) => headers.push(String(cell.value).trim()))

  const known = new Set([...REQUIRED, ...OPTIONAL])
  const missing = REQUIRED.filter((h) => !headers.includes(h))
  const unknown = headers.filter((h) => !known.has(h))

  console.log(`File headers: ${headers.length}`)
  console.log(`Declared headers: ${known.size}`)
  console.log(`Missing required:`, missing)
  console.log(`Unknown (in file, not declared):`, unknown)

  if (missing.length || unknown.length) {
    process.exit(1)
  }
  console.log("OK — every template header is declared in the guards definition.")
}

main().catch((e) => { console.error(e); process.exit(1) })

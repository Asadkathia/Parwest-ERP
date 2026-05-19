/**
 * Regenerates the guards-draft-editor acceptance fixture.
 *
 *   - rows 2-4: valid guards
 *   - row 5:    invalid CNIC ("12345") — tests fix-in-page + finalize
 *   - row 6:    phantom row with one formula-with-null cell + one empty
 *               rich-text — tests that the parser drops it silently
 *
 * Run:   node scripts/make-test-import.mjs
 * Out:   test-imports/guards-draft-test.xlsx
 */
import ExcelJS from "exceljs"
import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"

const headers = [
  "name", "cnic", "father name", "date of birth", "contact no", "designation",
  "current address", "marital_status",
]

const outPath = "test-imports/guards-draft-test.xlsx"
await mkdir(dirname(outPath), { recursive: true })

const wb = new ExcelJS.Workbook()
wb.creator = "bulk-import draft-editor QA fixture"
const ws = wb.addWorksheet("Guards")
ws.addRow(headers)

// Use random-looking CNICs that won't collide with real data
ws.addRow(["QA Ahmed Khan",  "35201-9888001-1", "Khan Sahib",   "1990-05-12", "03001234001", "Guard",      "House 1, Karachi", "single"])
ws.addRow(["QA Bilal Ahmed", "42101-9888002-2", "Ahmed Senior", "1988-11-03", "03001234002", "Guard",      "House 2, Lahore",  "married"])
ws.addRow(["QA Sara Iqbal",  "61101-9888003-3", "Iqbal Saab",   "1992-02-28", "03001234003", "Supervisor", "House 3, Multan",  "single"])

// Bad CNIC — fixable in-page
ws.addRow(["QA Faisal Raza", "12345",            "Raza Bhai",    "1995-07-15", "03001234004", "Guard",      "House 4, Quetta",  "single"])

// Phantom row — should be dropped at parse
const phantom = ws.addRow([null, null, null, null, null, null, null, null])
phantom.getCell(4).value = { formula: 'IF(1=2,"x",NA())', result: null }
phantom.getCell(7).value = { richText: [{ text: "" }] }

await wb.xlsx.writeFile(outPath)
console.log(`Wrote ${outPath}\n`)
console.log("Expected after Upload & Open Editor (with imports.draftEditor=true):")
console.log("  • Lands on /imports/drafts/<id>")
console.log("  • Totals: 4 total · 3 valid · 1 errored · 0 skipped  (phantom dropped)")
console.log("  • Row 5 (Faisal Raza): CNIC cell red, tooltip says format error")
console.log("  • After fixing CNIC → errored drops to 0, valid to 4")
console.log("  • Import button enables → finalize → COMPLETED with successRows=4")
console.log("\nIMPORTANT: this creates 4 real guards in your DB. The CNICs are")
console.log("intentionally non-matching (35201-9888001 / 35202-9888002 etc.) so you can find + delete them.")

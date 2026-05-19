#!/usr/bin/env node
/**
 * Integration test for the draft editor lifecycle.
 *
 * Usage: BASE_URL=http://localhost:3000 node scripts/integration/imports-draft-flow.mjs
 *
 * Requires:
 *   - Dev server running (npm run dev)
 *   - DRAFT migration applied to the connected DB (prisma migrate deploy)
 *   - Seeded admin credentials (defaults match the existing api-integration-test harness)
 *
 * Steps:
 *   1. Sign in as admin
 *   2. POST /api/imports/guards/draft with 4 rows (2 valid, 1 bad-CNIC, 1 empty)
 *   3. GET /api/imports/drafts/:id → expects 1 errored
 *   4. PATCH the bad-CNIC row → errored drops to 0
 *   5. POST /finalize → COMPLETED
 *   6. DELETE leftover drafts created by the test
 */
const BASE_URL = process.env.BASE_URL || "http://localhost:3000"
const EMAIL = process.env.TEST_EMAIL || "admin@parwestgroup.com"
const PASSWORD = process.env.TEST_PASSWORD || "admin123@"

let cookieJar = {}

function serializeCookies() {
  return Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join("; ")
}
function absorbCookies(headerValue) {
  if (!headerValue) return
  const values = Array.isArray(headerValue) ? headerValue : [headerValue]
  for (const entry of values) {
    for (const part of entry.split(", ")) {
      const [pair] = part.split(";")
      const eqIdx = pair.indexOf("=")
      if (eqIdx === -1) continue
      cookieJar[pair.substring(0, eqIdx).trim()] = pair.substring(eqIdx + 1).trim()
    }
  }
}

async function login() {
  cookieJar = {}
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`, { headers: { Cookie: serializeCookies() } })
  absorbCookies(csrfRes.headers.get("set-cookie"))
  const { csrfToken } = await csrfRes.json()
  if (!csrfToken) { console.error("No CSRF"); process.exit(1) }
  const params = new URLSearchParams({ email: EMAIL, password: PASSWORD, csrfToken, redirect: "false", json: "true" })
  const signin = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: serializeCookies() },
    body: params,
    redirect: "manual",
  })
  absorbCookies(signin.headers.get("set-cookie"))
  const sess = await fetch(`${BASE_URL}/api/auth/session`, { headers: { Cookie: serializeCookies() } })
  const sessionJson = await sess.json()
  if (!sessionJson?.user?.email) { console.error("session not established", sessionJson); process.exit(1) }
  console.log("logged in as", sessionJson.user.email, "role:", sessionJson.user.role)
  return sessionJson
}

async function api(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json", Cookie: serializeCookies() } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE_URL}${path}`, opts)
  absorbCookies(res.headers.get("set-cookie"))
  let data
  try { data = await res.json() } catch { data = {} }
  return { status: res.status, data }
}

function assert(cond, msg) {
  if (!cond) { console.error("  ❌ FAIL:", msg); process.exit(1) }
  console.log("  ✓", msg)
}

async function cleanupExistingDraft() {
  // Best-effort: discard any leftover guards draft from a previous failed run
  const list = await api("GET", "/api/imports/jobs?module=guards&status=DRAFT&take=5")
  if (list.status !== 200) return
  const drafts = Array.isArray(list.data?.data) ? list.data.data : []
  for (const d of drafts) {
    await api("DELETE", `/api/imports/drafts/${d.id}`)
  }
}

async function run() {
  await login()
  console.log("\n--- pre-test cleanup ---")
  await cleanupExistingDraft()

  console.log("\n--- create draft ---")
  const create = await api("POST", "/api/imports/guards/draft", {
    headers: ["name", "cnic"],
    rows: [
      { name: "Draft Ahmed", cnic: "35201-9888001-1" },
      { name: "Draft Sara", cnic: "35202-9888002-2" },
      { name: "Draft Bad", cnic: "12345" },
      { name: null, cnic: null },
    ],
    fileName: "draft-integration-test.json",
  })
  assert(create.status === 201, `draft created (got ${create.status})`)
  const draftId = create.data.data.draftId
  console.log("  draftId:", draftId)

  console.log("\n--- inspect draft ---")
  const draft = await api("GET", `/api/imports/drafts/${draftId}`)
  assert(draft.status === 200, "draft GET ok")
  assert(draft.data.data.totals.total === 4, `4 total rows (got ${draft.data.data.totals.total})`)
  assert(draft.data.data.totals.errored >= 1, `at least one errored row (got ${draft.data.data.totals.errored})`)

  console.log("\n--- patch bad CNIC ---")
  const fix = await api("PATCH", `/api/imports/drafts/${draftId}/rows/4`, {
    data: { cnic: "35203-9888003-3" },
  })
  assert(fix.status === 200, `patched (got ${fix.status})`)
  assert(Array.isArray(fix.data.data.row.errors) && fix.data.data.row.errors.length === 0, "row now clean")

  console.log("\n--- skip the empty row ---")
  const skip = await api("PATCH", `/api/imports/drafts/${draftId}/rows/5/skip`, { skipped: true })
  assert(skip.status === 200, "skip ok")

  console.log("\n--- inspect after fixes ---")
  const after = await api("GET", `/api/imports/drafts/${draftId}`)
  assert(after.data.data.totals.errored === 0, `0 errored (got ${after.data.data.totals.errored})`)
  assert(after.data.data.totals.skipped === 1, `1 skipped (got ${after.data.data.totals.skipped})`)
  assert(after.data.data.totals.valid === 3, `3 valid (got ${after.data.data.totals.valid})`)

  console.log("\n--- finalize ---")
  const fin = await api("POST", `/api/imports/drafts/${draftId}/finalize`)
  console.log("  finalize:", fin.status, JSON.stringify(fin.data).slice(0, 200))
  assert(fin.status === 200, `finalize 200 (got ${fin.status})`)
  assert(fin.data.data.successRows === 3, `successRows=3 (got ${fin.data.data.successRows})`)

  console.log("\nAll draft-lifecycle assertions passed ✓")
  console.log("\nNOTE: The imported guards are real DB rows. If you want to clean up:")
  console.log("  Find them by CNICs starting 35201-9888001, 35202-9888002, 35203-9888003")
}

run().catch((e) => { console.error(e); process.exit(1) })

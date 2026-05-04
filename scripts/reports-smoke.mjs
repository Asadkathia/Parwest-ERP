#!/usr/bin/env node
// Smoke test for the new reporting module endpoints.
// Usage: ADMIN_EMAIL=admin@parwestgroup.com ADMIN_PASSWORD=admin123@ node scripts/reports-smoke.mjs
// Requires the dev server running on $BASE_URL (default http://localhost:3000).

const BASE_URL = process.env.BASE_URL || "http://localhost:3000"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@parwestgroup.com"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123@"

const cookies = new Map()

function setCookie(headerValue) {
  if (!headerValue) return
  for (const piece of headerValue.split(/,(?=[^;]+=)/)) {
    const [pair] = piece.split(";")
    const [name, ...rest] = pair.split("=")
    cookies.set(name.trim(), rest.join("=").trim())
  }
}

function cookieHeader() {
  return Array.from(cookies.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ")
}

async function request(path, init = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Cookie: cookieHeader(),
    },
  })
  setCookie(res.headers.get("set-cookie"))
  return res
}

async function login() {
  const csrfRes = await request("/api/auth/csrf")
  const { csrfToken } = await csrfRes.json()
  const body = new URLSearchParams({
    csrfToken,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    callbackUrl: BASE_URL,
    json: "true",
  })
  const signInRes = await request("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "manual",
  })
  if (signInRes.status >= 400) {
    throw new Error(`Login failed: ${signInRes.status}`)
  }
  const sessRes = await request("/api/auth/session")
  const session = await sessRes.json()
  if (!session?.user?.email) {
    throw new Error("No session after login")
  }
  console.log(`✓ Logged in as ${session.user.email} (role: ${session.user.role})`)
}

const results = []
function check(label, ok, detail = "") {
  results.push({ label, ok, detail })
  console.log(`  ${ok ? "✅" : "❌"} ${label}${detail ? `  — ${detail}` : ""}`)
}

async function run() {
  console.log(`Reports smoke against ${BASE_URL}\n`)
  await login()

  console.log("\n--- Catalog ---")
  const catalogRes = await request("/api/reports/catalog")
  const catalogJson = await catalogRes.json()
  const catalog = catalogJson?.data ?? []
  check("GET /api/reports/catalog returns 200", catalogRes.status === 200, `status=${catalogRes.status}`)
  check("Catalog has >= 25 reports", catalog.length >= 25, `count=${catalog.length}`)
  check(
    "Catalog includes guards.hired",
    catalog.some((d) => d.key === "guards.hired"),
    ""
  )

  console.log("\n--- Dashboard ---")
  const dashRes = await request("/api/reports/dashboard")
  const dashJson = await dashRes.json()
  const dash = dashJson?.data ?? {}
  check("GET /api/reports/dashboard returns 200", dashRes.status === 200, `status=${dashRes.status}`)
  check("Dashboard has kpis.totalGuards", typeof dash.kpis?.totalGuards === "number", `${dash.kpis?.totalGuards}`)
  check("Dashboard has deployTrend array", Array.isArray(dash.deployTrend), "")
  check("Dashboard has salaryMoM array", Array.isArray(dash.salaryMoM), "")
  check("Dashboard has inventoryByStatus array", Array.isArray(dash.inventoryByStatus), "")

  console.log("\n--- Run report (xlsx) ---")
  const todayIso = new Date().toISOString().slice(0, 10)
  const yearAgoIso = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const runRes = await request("/api/reports/run/guards.hired", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format: "xlsx", params: { from: yearAgoIso, to: todayIso } }),
  })
  const runJson = await runRes.json()
  const run = runJson?.data ?? {}
  check("POST /api/reports/run/guards.hired returns 200", runRes.status === 200, `status=${runRes.status} msg=${runJson?.message}`)
  check("Run returned runId + downloadUrl", Boolean(run.runId && run.downloadUrl), `runId=${run.runId} rows=${run.rowCount}`)

  if (run.runId) {
    const dlRes = await request(run.downloadUrl)
    const ct = dlRes.headers.get("content-type") || ""
    check("Download returns 200", dlRes.status === 200, `status=${dlRes.status}`)
    check("Download is XLSX content-type", ct.includes("spreadsheetml"), ct)
    const buf = Buffer.from(await dlRes.arrayBuffer())
    check("Download has non-empty body", buf.byteLength > 100, `bytes=${buf.byteLength}`)
  }

  console.log("\n--- Run report (csv) ---")
  const csvRunRes = await request("/api/reports/run/deployments.current", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format: "csv", params: {} }),
  })
  const csvRunJson = await csvRunRes.json()
  check("POST run deployments.current csv returns 200", csvRunRes.status === 200, `status=${csvRunRes.status} msg=${csvRunJson?.message}`)

  console.log("\n--- Run report (pdf) ---")
  const pdfRunRes = await request("/api/reports/run/inventory.total", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format: "pdf", params: {} }),
  })
  const pdfRunJson = await pdfRunRes.json()
  check("POST run inventory.total pdf returns 200", pdfRunRes.status === 200, `status=${pdfRunRes.status} msg=${pdfRunJson?.message}`)

  console.log("\n--- Negative cases ---")
  const unknownRes = await request("/api/reports/run/does.not.exist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format: "csv", params: {} }),
  })
  check("Unknown report key returns 404", unknownRes.status === 404, `status=${unknownRes.status}`)

  const badFmtRes = await request("/api/reports/run/guards.hired", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format: "doc", params: {} }),
  })
  check("Invalid format returns 400", badFmtRes.status === 400, `status=${badFmtRes.status}`)

  console.log("\n--- Library ---")
  const libRes = await request("/api/reports/library?take=20")
  const libJson = await libRes.json()
  check("GET /api/reports/library returns 200", libRes.status === 200, `status=${libRes.status}`)
  check("Library returns array", Array.isArray(libJson?.data), `count=${libJson?.data?.length ?? 0}`)
  check(
    "Library contains the runs we just created",
    Array.isArray(libJson?.data) && libJson.data.length >= 3,
    ""
  )

  console.log("\n--- Scheduled ---")
  const schedRes = await request("/api/reports/scheduled")
  const schedJson = await schedRes.json()
  check("GET /api/reports/scheduled returns 200", schedRes.status === 200, `status=${schedRes.status}`)
  check("Scheduled returns array", Array.isArray(schedJson?.data), `count=${schedJson?.data?.length ?? 0}`)

  // Create + delete a schedule to exercise the CRUD path.
  const createSchedRes = await request("/api/reports/scheduled", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reportKey: "guards.hired",
      paramsJson: { from: yearAgoIso, to: todayIso },
      formats: ["XLSX"],
      cron: "0 7 * * *",
      timezone: "Asia/Karachi",
      recipients: ["test@parwest.local"],
    }),
  })
  const createSchedText = await createSchedRes.text()
  let createSchedJson = null
  try {
    createSchedJson = JSON.parse(createSchedText)
  } catch {
    // leave null; surface the body in the detail
  }
  const newId = createSchedJson?.data?.id
  check(
    "POST /api/reports/scheduled creates a row",
    createSchedRes.status === 200 && Boolean(newId),
    `status=${createSchedRes.status} id=${newId} body=${createSchedText.slice(0, 200)}`
  )

  if (newId) {
    const deleteSchedRes = await request(`/api/reports/scheduled/${newId}`, {
      method: "DELETE",
    })
    check("DELETE /api/reports/scheduled/[id] returns 200", deleteSchedRes.status === 200, `status=${deleteSchedRes.status}`)
  }

  console.log("\n--- Summary ---")
  const passed = results.filter((r) => r.ok).length
  const failed = results.length - passed
  console.log(`${passed}/${results.length} passed${failed ? ` · ${failed} failed` : ""}`)
  process.exit(failed === 0 ? 0 : 1)
}

run().catch((err) => {
  console.error("Smoke aborted:", err)
  process.exit(2)
})

import fs from 'fs/promises'
import path from 'path'

const legacy = JSON.parse(await fs.readFile('artifacts/legacy-audit/legacy-audit.json', 'utf8'))

const directMap = new Map([
  ['/dashboard', '/dashboard'], ['/map', '/dashboard'], ['/user/onlineUsers', '/dashboard/online-users'],
  ['/guard/create', '/guards/new'], ['/guard/search', '/guards/search'], ['/guard/blackListedGuards', '/guards/blacklist'], ['/guard/softDeletedGuardList', '/guards/inactive'],
  ['/guard/GuardDeployment', '/guards/deploy'], ['/guard/GuardDeploymentRate', '/guards/deployments-rate'], ['/guard/attendance', '/guards/attendance'], ['/guard/clientAttendance', '/guards/client-attendance'],
  ['/guard/residences', '/guards/residences'], ['/guard/residences/assign', '/guards/assign-residence'], ['/guard/onjob-trainings', '/guards/trainings'], ['/guard/onjob-trainings-v2', '/guards/trainings'],
  ['/guard/guardPledgeableDocumentTypeList', '/settings/guard-pledgeable-documents'], ['/guard/guardBankNames', '/settings/guard-bank-names'], ['/guard/regionalOffices', '/settings/offices'],
  ['/guard/payrollDefaults', '/payroll/settings'], ['/guard/monthInitialise', '/payroll/settings'], ['/guard/guardAgeLimitForm', '/payroll/settings'], ['/guard/guardMentalHealthForm', '/payroll/settings'],
  ['/guard/accountLoan', '/payroll/operations/loan'], ['/guard/payrollExtraHours', '/payroll/operations/extra-hours'], ['/guard/payrollOtherDeductions', '/payroll/operations/other-deductions'], ['/guard/payrollSpecialDuty', '/payroll/operations/special-duty'],
  ['/guard/payrollHolidays', '/payroll/operations/holidays'], ['/guard/accountSalary', '/payroll/operations/salary-v2'], ['/guard/accountUnPaid', '/payroll/operations/unpaid-salaries'], ['/guard/bulk-salary-slip', '/payroll/operations/bulk-salary-slips'],
  ['/guard/accountClearance', '/payroll/operations/clearance'], ['/guard/accountSalaryExport', '/payroll/reports'], ['/guard/accountSalaryExportUnpaid', '/payroll/reports'], ['/guard/accountBulkExportUnpaid', '/payroll/reports'], ['/guard/accountClearanceExport', '/payroll/reports'], ['/guard/salarySummary', '/payroll/reports'],
  ['/salary-v2', '/payroll/operations/salary-v2'], ['/client/create', '/clients/new'], ['/client/searchResult', '/clients/search'], ['/client/v2/search', '/clients/search-v2'], ['/client/typeList', '/clients/types-locations'], ['/client/blackListedClients', '/clients/blacklist'], ['/client/exportClientBranches', '/clients/export-branches'],
  ['/client/invoicePrerequisites', '/clients/invoice-prerequisites'], ['/client/invoicedBillings', '/clients/invoiced-billings'], ['/inventory/dashboard', '/inventory'], ['/inventory/searchCustom', '/inventory/search'], ['/inventory/createProduct', '/inventory/stock-in'], ['/inventory/categoryList', '/inventory/categories'],
  ['/inventory/vendorList', '/inventory/vendors'], ['/inventory/conditionList', '/inventory/conditions'], ['/inventory/demandInventoryForm', '/inventory/demand'], ['/inventory/assignProductFormNew', '/inventory/assign-item'], ['/inventory/condemnedItems', '/inventory/condemned'], ['/user/create', '/users/new'],
  ['/user/searchForm', '/users/search'], ['/user/assignManagerToSupervisorForm', '/users/ms-relationship'], ['/user/assignClientsBranchToSupervisorForm', '/users/cs-relationship'], ['/user/switchManagerForm', '/users/switch-supervisor'], ['/user/allUserTypes', '/settings/user-types'], ['/ticket', '/tickets'], ['/prerequisites', '/guards/prerequisites'], ['/regions', '/settings/regions'],
])

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function dedupeNormalized(arr) {
  const m = new Map()
  for (const a of arr) {
    const n = norm(a)
    if (!n || n === 'unlabeled') continue
    if (!m.has(n)) m.set(n, a)
  }
  return m
}

async function exists(filePath) {
  try { await fs.access(filePath); return true } catch { return false }
}

async function listTsxFiles(dir) {
  const out = []
  async function walk(d) {
    let ents
    try { ents = await fs.readdir(d, { withFileTypes: true }) } catch { return }
    for (const e of ents) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) await walk(p)
      else if (e.isFile() && (p.endsWith('.ts') || p.endsWith('.tsx'))) out.push(p)
    }
  }
  await walk(dir)
  return out
}

function extractLabelsFromCode(src) {
  const vals = []

  const regexes = [
    /label\s*:\s*["'`]([^"'`]{1,120})["'`]/g,
    /placeholder\s*:\s*["'`]([^"'`]{1,120})["'`]/g,
    /placeholder\s*=\s*["'`]([^"'`]{1,120})["'`]/g,
    /<label[^>]*>([^<]{1,120})<\/label>/g,
  ]

  for (const re of regexes) {
    let m
    while ((m = re.exec(src)) !== null) {
      vals.push(m[1])
    }
  }
  return vals
}

async function currentFieldsForRoute(currentRoute) {
  const base = path.join('src', 'app', '(dashboard)')

  // dynamic routed screens backed by screenConfigs
  if (currentRoute.startsWith('/payroll/operations/')) {
    const key = currentRoute.split('/').pop()
    const sc = await fs.readFile(path.join('src', 'lib', 'parity', 'screenConfigs.ts'), 'utf8')
    const start = sc.indexOf(`${JSON.stringify(key)}:`)
    if (start !== -1) {
      const next = sc.indexOf('\n  },\n', start)
      const chunk = sc.slice(start, next === -1 ? undefined : next)
      return dedupeNormalized(extractLabelsFromCode(chunk))
    }
  }
  if (currentRoute.startsWith('/inventory/') && currentRoute !== '/inventory') {
    const key = currentRoute.split('/').pop()
    const sc = await fs.readFile(path.join('src', 'lib', 'parity', 'screenConfigs.ts'), 'utf8')
    const start = sc.indexOf(`${JSON.stringify(key)}:`)
    if (start !== -1) {
      const next = sc.indexOf('\n  },\n', start)
      const chunk = sc.slice(start, next === -1 ? undefined : next)
      return dedupeNormalized(extractLabelsFromCode(chunk))
    }
  }
  if (currentRoute.startsWith('/reports/') && currentRoute !== '/reports') {
    const key = currentRoute.split('/').pop()
    const sc = await fs.readFile(path.join('src', 'lib', 'parity', 'screenConfigs.ts'), 'utf8')
    const start = sc.indexOf(`${JSON.stringify(key)}:`)
    if (start !== -1) {
      const next = sc.indexOf('\n  },\n', start)
      const chunk = sc.slice(start, next === -1 ? undefined : next)
      return dedupeNormalized(extractLabelsFromCode(chunk))
    }
  }

  const routeDir = path.join(base, currentRoute)
  const files = await listTsxFiles(routeDir)
  if (!files.length) return new Map()

  const all = []
  for (const f of files) {
    const src = await fs.readFile(f, 'utf8')
    all.push(...extractLabelsFromCode(src))
  }
  return dedupeNormalized(all)
}

function moduleOfLegacy(route) {
  const seg = route.split('/').filter(Boolean)[0] || 'root'
  if (seg === 'guard') return 'Guards'
  if (seg === 'client') return 'Clients'
  if (seg === 'inventory') return 'Inventory'
  if (seg === 'user') return 'Users'
  if (seg === 'ticket') return 'Ticketing'
  if (seg === 'dashboard' || seg === 'map') return 'Dashboard'
  if (seg === 'salary-v2' || seg === 'searchByDataTable') return 'Payroll'
  if (seg === 'regions' || seg === 'prerequisites') return 'Settings/System'
  if (seg === 'reports') return 'Reports'
  if (seg === 'audit') return 'Audit'
  if (seg === 'bulkImport') return 'Imports'
  return seg
}

const visitedByPath = new Map()
for (const p of legacy.pages) {
  let k = ''
  try { k = new URL(p.finalUrl || p.menuUrl).pathname } catch {}
  if (k && !visitedByPath.has(k)) visitedByPath.set(k, p)
}

const legacyRoutes = [...new Set(legacy.menuLinks.map((m) => new URL(m.href).pathname))].sort()
const rows = []

for (const lr of legacyRoutes) {
  const page = visitedByPath.get(lr)
  const legacyFieldLabels = (page?.forms || []).flatMap((s) => (s.fields || []).map((f) => f.label)).filter(Boolean)
  const legacySet = dedupeNormalized(legacyFieldLabels)
  const mapped = directMap.get(lr) || ''

  let currentSet = new Map()
  if (mapped) {
    currentSet = await currentFieldsForRoute(mapped)
  }

  const matched = []
  const missing = []

  for (const [n, original] of legacySet.entries()) {
    if (currentSet.has(n)) matched.push(original)
    else missing.push(original)
  }

  const legacyCount = legacySet.size
  const currentCount = currentSet.size
  const matchedCount = matched.length
  const score = legacyCount ? matchedCount / legacyCount : 1

  let status = 'N/A'
  if (!mapped) status = 'MISSING_ROUTE'
  else if (legacyCount === 0) status = 'NO_LEGACY_FIELDS_DETECTED'
  else if (score >= 0.7) status = 'MATCHED'
  else if (score >= 0.35) status = 'PARTIAL'
  else status = 'LOW_COVERAGE'

  rows.push({
    module: moduleOfLegacy(lr),
    legacyRoute: lr,
    mappedCurrentRoute: mapped,
    legacyFields: legacyCount,
    currentFields: currentCount,
    matchedFields: matchedCount,
    score: Number((score * 100).toFixed(1)),
    status,
    missing: missing.slice(0, 30),
  })
}

const csv = [
  'module,legacy_route,mapped_current_route,legacy_fields,current_fields,matched_fields,match_percent,status,missing_sample',
  ...rows.map((r) => [
    r.module,
    r.legacyRoute,
    r.mappedCurrentRoute,
    r.legacyFields,
    r.currentFields,
    r.matchedFields,
    r.score,
    r.status,
    r.missing.join(' | '),
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
]
await fs.writeFile('docs/legacy-vs-current-form-parity.csv', csv.join('\n'))

const mapped = rows.filter((r) => r.mappedCurrentRoute)
const mappedWithLegacyFields = mapped.filter((r) => r.legacyFields > 0)
const avgScore = mappedWithLegacyFields.length
  ? (mappedWithLegacyFields.reduce((a, b) => a + b.score, 0) / mappedWithLegacyFields.length).toFixed(1)
  : '0.0'

const matchedCount = mappedWithLegacyFields.filter((r) => r.status === 'MATCHED').length
const partialCount = mappedWithLegacyFields.filter((r) => r.status === 'PARTIAL').length
const lowCount = mappedWithLegacyFields.filter((r) => r.status === 'LOW_COVERAGE').length
const missingRoutes = rows.filter((r) => r.status === 'MISSING_ROUTE').length

let md = '# Form Parity Audit: Legacy ERP vs Current ERP\n\n'
md += `- Source legacy crawl: \`artifacts/legacy-audit/legacy-audit.json\`\n`
md += `- Total legacy menu routes: **${rows.length}**\n`
md += `- Routes with direct mapping to current ERP: **${mapped.length}**\n`
md += `- Routes with no mapping (form not added as equivalent): **${missingRoutes}**\n`
md += `- Mapped routes with detected legacy form fields: **${mappedWithLegacyFields.length}**\n`
md += `- Average field match on mapped form routes: **${avgScore}%**\n`
md += `- Status counts: MATCHED **${matchedCount}**, PARTIAL **${partialCount}**, LOW_COVERAGE **${lowCount}**\n\n`

md += '## High-Priority Form Gaps (Mapped but not fully matched)\n'
for (const r of rows.filter((x) => x.mappedCurrentRoute && (x.status === 'PARTIAL' || x.status === 'LOW_COVERAGE')).sort((a, b) => a.score - b.score).slice(0, 25)) {
  md += `- ${r.legacyRoute} -> ${r.mappedCurrentRoute}: ${r.score}% (${r.matchedFields}/${r.legacyFields})\n`
  if (r.missing.length) md += `  missing sample: ${r.missing.slice(0, 10).join(', ')}\n`
}

md += '\n## Missing Form Routes (No current equivalent mapping)\n'
for (const r of rows.filter((x) => x.status === 'MISSING_ROUTE')) {
  md += `- ${r.legacyRoute}\n`
}

md += '\n## Notes\n'
md += '- This audit is field-label based and conservative; dynamic labels or modal-only fields may be undercounted.\n'
md += '- For dynamic parity screens, labels were extracted from `src/lib/parity/screenConfigs.ts`; for concrete pages, labels/placeholders were extracted from route files.\n'
md += '- Use `docs/legacy-vs-current-form-parity.csv` for full per-route detail.\n'

await fs.writeFile('docs/legacy-vs-current-form-parity.md', md)

console.log({
  totalRoutes: rows.length,
  mappedRoutes: mapped.length,
  missingRoutes,
  avgScore,
  matchedCount,
  partialCount,
  lowCount,
})

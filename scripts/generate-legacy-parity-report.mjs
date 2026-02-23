import fs from 'fs/promises'

const legacy = JSON.parse(await fs.readFile('artifacts/legacy-audit/legacy-audit.json', 'utf8'))
const currentRoutes = new Set((await fs.readFile('/tmp/current_routes.txt', 'utf8')).split('\n').map((s) => s.trim()).filter(Boolean))

const legacyRoutes = [...new Set(legacy.menuLinks.map((m) => new URL(m.href).pathname))].sort()
const visitedByPath = new Map()
for (const p of legacy.pages) {
  const key = (() => {
    try { return new URL(p.finalUrl || p.menuUrl).pathname } catch { return p.menuUrl || '' }
  })()
  if (!visitedByPath.has(key)) visitedByPath.set(key, p)
}

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

function isMappedRoutePresent(mapped) {
  if (!mapped) return false
  if (currentRoutes.has(mapped)) return true

  if (mapped.startsWith('/payroll/operations/') && currentRoutes.has('/payroll/operations/[screen]')) return true
  if (mapped.startsWith('/inventory/') && mapped !== '/inventory' && currentRoutes.has('/inventory/[screen]')) return true
  if (mapped.startsWith('/reports/') && mapped !== '/reports' && currentRoutes.has('/reports/[screen]')) return true
  if (mapped.startsWith('/imports/') && mapped !== '/imports' && currentRoutes.has('/imports/[screen]')) return true
  if (mapped.startsWith('/clients/branches/') && currentRoutes.has('/clients/branches/[id]')) return true
  if (mapped.startsWith('/clients/') && mapped.match(/^\/clients\/[^/]+$/) && currentRoutes.has('/clients/[id]')) return true
  if (mapped.startsWith('/guards/') && mapped.match(/^\/guards\/[^/]+$/) && currentRoutes.has('/guards/[id]')) return true

  return false
}

function moduleOfLegacy(route) {
  const seg = route.split('/').filter(Boolean)[0] || 'root'
  if (seg === 'guard') return 'Guards'
  if (seg === 'client') return 'Clients'
  if (seg === 'inventory') return 'Inventory'
  if (seg === 'user') return 'Users & Access'
  if (seg === 'ticket') return 'Ticketing'
  if (seg === 'dashboard' || seg === 'map') return 'Dashboard'
  if (seg === 'salary-v2' || seg === 'searchByDataTable') return 'Payroll'
  if (seg === 'regions' || seg === 'prerequisites') return 'Settings/System'
  if (seg === 'reports') return 'Reports'
  if (seg === 'audit') return 'Audit'
  if (seg === 'bulkImport') return 'Imports'
  return seg
}

const rows = legacyRoutes.map((lr) => {
  const mapped = directMap.get(lr) || ''
  const replicated = isMappedRoutePresent(mapped)
  return { module: moduleOfLegacy(lr), legacyRoute: lr, mappedCurrentRoute: mapped, replicated }
})

const byModule = {}
for (const r of rows) {
  byModule[r.module] ??= { total: 0, replicated: 0 }
  byModule[r.module].total += 1
  if (r.replicated) byModule[r.module].replicated += 1
}

const total = rows.length
const replicated = rows.filter((r) => r.replicated).length
const pct = total ? ((replicated / total) * 100).toFixed(1) : '0.0'
const mappedRows = rows.filter((r) => r.mappedCurrentRoute)
const mappedReplicated = mappedRows.filter((r) => r.replicated).length
const mappedPct = mappedRows.length ? ((mappedReplicated / mappedRows.length) * 100).toFixed(1) : '0.0'

const unmatched = rows.filter((r) => !r.replicated)

const parityCsv = [
  'module,legacy_route,mapped_current_route,replicated',
  ...rows.map((r) => [r.module, r.legacyRoute, r.mappedCurrentRoute, r.replicated ? 'YES' : 'NO'].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
].join('\n')
await fs.writeFile('docs/legacy-vs-current-route-parity.csv', parityCsv)

let pageCatalog = '# Legacy ERP Page Catalog (Staging Crawl)\n\n'
pageCatalog += `- Audited at: ${legacy.auditedAt}\n`
pageCatalog += `- Menu links discovered: ${legacy.totalMenuLinks}\n`
pageCatalog += `- Pages visited in crawl: ${legacy.pages.length}\n`
pageCatalog += `- Screenshot folder: artifacts/legacy-audit/screenshots/\n\n`

for (const r of legacyRoutes) {
  const p = visitedByPath.get(r)
  pageCatalog += `## ${r}\n`
  if (!p) { pageCatalog += '- Not visited in this run (link discovered only).\n\n'; continue }
  if (p.error) { pageCatalog += `- Error: ${p.error}\n\n`; continue }
  pageCatalog += `- Final URL: ${p.finalUrl}\n`
  pageCatalog += `- Title: ${p.title || '—'}\n`
  pageCatalog += `- Primary heading: ${(p.headings || [])[0] || '—'}\n`
  pageCatalog += `- Tabs: ${(p.tabLabels || []).slice(0, 15).join(', ') || '—'}\n`
  pageCatalog += `- Table headers: ${(p.tableHeaders || []).slice(0, 20).join(', ') || '—'}\n`
  pageCatalog += `- Key buttons: ${(p.buttons || []).slice(0, 20).join(', ') || '—'}\n`
  if (Array.isArray(p.forms) && p.forms.length) {
    pageCatalog += '- Forms/fields:\n'
    for (const f of p.forms.slice(0, 8)) {
      const fields = (f.fields || []).map((x) => x.label).filter(Boolean)
      pageCatalog += `  - ${f.sectionTitle || `Section ${f.sectionIndex}`}: ${fields.slice(0, 20).join(', ')}\n`
    }
  } else {
    pageCatalog += '- Forms/fields: —\n'
  }
  pageCatalog += `- Screenshot: ${p.screenshot || '—'}\n\n`
}
await fs.writeFile('docs/legacy-erp-page-catalog.md', pageCatalog)

let report = '# Legacy vs Current ERP Replication Report\n\n'
report += `## Coverage Snapshot\n`
report += `- Legacy routes discovered from staging menu: **${total}**\n`
report += `- Mapped and currently replicated routes: **${replicated}**\n`
report += `- Overall route-level replication: **${pct}%**\n`
report += `- Replication for mapped legacy endpoints only: **${mappedReplicated}/${mappedRows.length} (${mappedPct}%)**\n\n`
report += `## Module Breakdown\n`
for (const [module, stat] of Object.entries(byModule)) {
  const mpct = stat.total ? ((stat.replicated / stat.total) * 100).toFixed(1) : '0.0'
  report += `- ${module}: ${stat.replicated}/${stat.total} (${mpct}%)\n`
}

report += `\n## Major Gaps To Reach Exact Legacy Parity\n`
const major = [
  '/bulkImport/', '/reports/', '/audit/auditSearch', '/client/clientInsuranceSettings', '/guard/mergedOptions', '/guard/status-update', '/user/updateLogos', '/user/guardVerificationStatusesList', '/user/guardVerificationTypesList'
]
for (const u of unmatched.filter((x) => major.some((m) => x.legacyRoute.includes(m)))) {
  report += `- ${u.legacyRoute}\n`
}

report += `\n## Full Unmatched List\n`
for (const u of unmatched) {
  report += `- ${u.legacyRoute}${u.mappedCurrentRoute ? ` -> expected ${u.mappedCurrentRoute}` : ''}\n`
}

report += `\n## Notes\n`
report += `- This comparison is based on live staging crawl + current Next.js route structure.\n`
report += `- Dynamic route handlers (/payroll/operations/[screen], /inventory/[screen], /reports/[screen]) are counted as replicated when mapped subpaths exist.\n`
report += `- Exact workflow parity still requires manual UAT for create/edit/approve/export/import actions and modal behavior.\n`
report += `- Artifacts: \`artifacts/legacy-audit/legacy-audit.json\`, \`artifacts/legacy-audit/legacy-routes.csv\`, \`docs/legacy-vs-current-route-parity.csv\`, \`docs/legacy-erp-page-catalog.md\`.\n`

await fs.writeFile('docs/legacy-vs-current-replication.md', report)

console.log('Generated reports.')
console.log({ totalLegacyRoutes: total, replicatedRoutes: replicated, pct, mappedRows: mappedRows.length, mappedReplicated, mappedPct })

import fs from 'fs/promises'
import path from 'path'
import { chromium } from 'playwright'

const BASE_URL = 'https://staging-erp.parwestgroup.com/'
const EMAIL = 'admin@parwestgroup.com'
const PASSWORD = 'admin123@'

const mappings = [
  { screen: 'Add Guard', legacy: '/guard/create', current: '/guards/new' },
  { screen: 'Search Guard', legacy: '/guard/search', current: '/guards/search' },
  { screen: 'Export Guard', legacy: '/searchByDataTable', current: '/guards/export' },
  { screen: 'Prerequisites', legacy: '/guard/mergedOptions', current: '/guards/prerequisites' },
  { screen: 'Black Listed Guards', legacy: '/guard/blackListedGuards', current: '/guards/blacklist' },
  { screen: 'Inactive Guards', legacy: '/guard/softDeletedGuardList', current: '/guards/inactive' },
  { screen: 'Deploy Guards', legacy: '/guard/GuardDeployment', current: '/guards/deploy' },
  { screen: 'Deployment Rate', legacy: '/guard/GuardDeploymentRate', current: '/guards/deployments-rate' },
  { screen: 'Guard Attendance', legacy: '/guard/attendance', current: '/guards/attendance' },
  { screen: 'Client Attendance', legacy: '/guard/clientAttendance', current: '/guards/client-attendance' },
  { screen: 'Residences', legacy: '/guard/residences', current: '/guards/residences' },
  { screen: 'Assign Residence', legacy: '/guard/residences/assign', current: '/guards/assign-residence' },
  { screen: 'Onjob Trainings', legacy: '/guard/onjob-trainings', current: '/guards/trainings' },
  { screen: 'Add Client', legacy: '/client/create', current: '/clients/new' },
  { screen: 'Search Client', legacy: '/client/searchResult', current: '/clients/search' },
  { screen: 'Search Client V2', legacy: '/client/v2/search', current: '/clients/search-v2' },
  { screen: 'Types & Locations', legacy: '/client/typeList', current: '/clients/types-locations' },
  { screen: 'Black Listed Clients', legacy: '/client/blackListedClients', current: '/clients/blacklist' },
  { screen: 'Export Client Branches', legacy: '/client/exportClientBranches', current: '/clients/export-branches' },
  { screen: 'Invoice Prerequisites', legacy: '/client/invoicePrerequisites', current: '/clients/invoice-prerequisites' },
  { screen: 'Invoiced Billings', legacy: '/client/invoicedBillings', current: '/clients/invoiced-billings' },
]

const OUT_MD = 'docs/form-parity-exact-verification.md'
const OUT_CSV = 'docs/form-parity-exact-verification.csv'

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()
const norm = (s) => clean(s).toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

function setFrom(arr) {
  const m = new Map()
  for (const x of arr) {
    const n = norm(x)
    if (!n) continue
    if (!m.has(n)) m.set(n, clean(x))
  }
  return m
}

async function listFiles(dir) {
  const out = []
  async function walk(d) {
    let ents = []
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

function extractCurrentLabelsOptions(source) {
  const labels = []
  const selectOptions = []

  const regexes = [
    /label\s*=\s*["'`]([^"'`]{1,180})["'`]/g,
    /<label[^>]*>([\s\S]*?)<\/label>/g,
    /placeholder\s*=\s*["'`]([^"'`]{1,180})["'`]/g,
    /placeholder\s*:\s*["'`]([^"'`]{1,180})["'`]/g,
  ]

  for (const re of regexes) {
    let m
    while ((m = re.exec(source)) !== null) {
      const text = clean(String(m[1]).replace(/<[^>]+>/g, ' '))
      if (text) labels.push(text)
    }
  }

  const optionTag = /<option[^>]*>([^<]{1,180})<\/option>/g
  let mo
  while ((mo = optionTag.exec(source)) !== null) {
    const opt = clean(mo[1])
    if (opt) selectOptions.push(opt)
  }

  // options={["A","B"]}
  const optionsArray = /options\s*=\s*\{\s*\[([\s\S]*?)\]\s*\}/g
  let ma
  while ((ma = optionsArray.exec(source)) !== null) {
    const chunk = ma[1]
    const str = /["'`]([^"'`]{1,180})["'`]/g
    let ms
    while ((ms = str.exec(chunk)) !== null) {
      const opt = clean(ms[1])
      if (opt) selectOptions.push(opt)
    }
  }

  return { labels, selectOptions }
}

async function getCurrentForRoute(route) {
  const dir = path.join('src', 'app', '(dashboard)', route)
  const files = await listFiles(dir)
  const allLabels = []
  const allOptions = []

  for (const f of files) {
    const src = await fs.readFile(f, 'utf8')
    const { labels, selectOptions } = extractCurrentLabelsOptions(src)
    allLabels.push(...labels)
    allOptions.push(...selectOptions)
  }

  // include config-driven screens
  const cfgPath = path.join('src', 'lib', 'parity', 'screenConfigs.ts')
  const cfg = await fs.readFile(cfgPath, 'utf8')
  if (route.startsWith('/payroll/operations/')) {
    const key = route.split('/').pop()
    const i = cfg.indexOf(`"${key}":`)
    if (i !== -1) {
      const j = cfg.indexOf('\n  },\n', i)
      const chunk = cfg.slice(i, j === -1 ? undefined : j)
      const x = extractCurrentLabelsOptions(chunk)
      allLabels.push(...x.labels)
      allOptions.push(...x.selectOptions)
    }
  }

  if (route.startsWith('/inventory/') && route !== '/inventory') {
    const key = route.split('/').pop()
    const i = cfg.indexOf(`"${key}":`)
    if (i !== -1) {
      const j = cfg.indexOf('\n  },\n', i)
      const chunk = cfg.slice(i, j === -1 ? undefined : j)
      const x = extractCurrentLabelsOptions(chunk)
      allLabels.push(...x.labels)
      allOptions.push(...x.selectOptions)
    }
  }

  return {
    labels: setFrom(allLabels),
    options: setFrom(allOptions),
  }
}

async function login(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.locator('input[type="email"], input[name*="email" i], input[id*="email" i]').first().fill(EMAIL)
  await page.locator('input[type="password"], input[name*="password" i], input[id*="password" i]').first().fill(PASSWORD)
  await Promise.all([
    page.waitForURL(/dashboard|guards|clients|payroll|inventory/i, { timeout: 60000 }).catch(() => null),
    page.locator('button:has-text("Login"), button:has-text("Sign In"), button[type="submit"], input[type="submit"]').first().click(),
  ])
  await page.waitForTimeout(1000)
}

async function getLegacyForRoute(context, legacyPath) {
  const page = await context.newPage()
  const url = new URL(legacyPath, BASE_URL).toString()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(700)

  const result = await page.evaluate(() => {
    const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()
    const labels = []
    const options = []

    const controls = Array.from(document.querySelectorAll('input, select, textarea'))

    for (const ctrl of controls) {
      const tag = ctrl.tagName.toLowerCase()
      const type = (ctrl.getAttribute('type') || '').toLowerCase()
      if (tag === 'input' && ['hidden', 'submit', 'button'].includes(type)) continue

      const id = ctrl.getAttribute('id') || ''
      let label = ''

      if (id) {
        const lbl = document.querySelector(`label[for="${id.replace(/"/g, '\\"')}"]`)
        if (lbl) label = clean(lbl.textContent)
      }
      if (!label) {
        const wrap = ctrl.closest('label')
        if (wrap) label = clean(wrap.textContent)
      }
      if (!label) {
        const prev = ctrl.previousElementSibling
        if (prev && prev.tagName.toLowerCase() === 'label') label = clean(prev.textContent)
      }
      if (!label) {
        label = clean(ctrl.getAttribute('placeholder') || ctrl.getAttribute('name') || ctrl.getAttribute('id') || '')
      }

      if (label) labels.push(label)

      if (tag === 'select') {
        const opts = Array.from(ctrl.querySelectorAll('option')).map((o) => clean(o.textContent)).filter(Boolean)
        options.push(...opts)
      }
    }

    return { labels, options }
  })

  const response = {
    labels: setFrom(result.labels),
    options: setFrom(result.options),
  }
  await page.close()
  return response
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()

const rows = []

try {
  await login(page)

  for (const m of mappings) {
    const legacyErr = ''
    try {
      const legacy = await getLegacyForRoute(context, m.legacy)
      const current = await getCurrentForRoute(m.current)

      const missingFields = []
      const matchedFields = []
      for (const [k, original] of legacy.labels.entries()) {
        if (current.labels.has(k)) matchedFields.push(original)
        else missingFields.push(original)
      }

      const missingOptions = []
      const matchedOptions = []
      for (const [k, original] of legacy.options.entries()) {
        // ignore noisy default prompt options
        if (['select', 'select all', 'nothing selected'].includes(k)) continue
        if (current.options.has(k)) matchedOptions.push(original)
        else missingOptions.push(original)
      }

      const fieldScore = legacy.labels.size ? (matchedFields.length / legacy.labels.size) * 100 : 100
      const optionScore = legacy.options.size ? (matchedOptions.length / legacy.options.size) * 100 : 100

      rows.push({
        screen: m.screen,
        legacy: m.legacy,
        current: m.current,
        legacyFieldCount: legacy.labels.size,
        currentFieldCount: current.labels.size,
        matchedFields: matchedFields.length,
        fieldScore: Number(fieldScore.toFixed(1)),
        legacyOptionCount: legacy.options.size,
        currentOptionCount: current.options.size,
        matchedOptions: matchedOptions.length,
        optionScore: Number(optionScore.toFixed(1)),
        missingFields: missingFields.slice(0, 25),
        missingOptions: missingOptions.slice(0, 25),
        error: legacyErr,
      })
    } catch (err) {
      rows.push({
        screen: m.screen,
        legacy: m.legacy,
        current: m.current,
        legacyFieldCount: 0,
        currentFieldCount: 0,
        matchedFields: 0,
        fieldScore: 0,
        legacyOptionCount: 0,
        currentOptionCount: 0,
        matchedOptions: 0,
        optionScore: 0,
        missingFields: [],
        missingOptions: [],
        error: String(err),
      })
    }
  }
} finally {
  await context.close()
  await browser.close()
}

const avgField = rows.length ? (rows.reduce((a, b) => a + b.fieldScore, 0) / rows.length).toFixed(1) : '0.0'
const avgOption = rows.length ? (rows.reduce((a, b) => a + b.optionScore, 0) / rows.length).toFixed(1) : '0.0'

let md = '# Exact Form Field Verification (Legacy vs Current)\n\n'
md += `- Screens checked: **${rows.length}**\n`
md += `- Average field match: **${avgField}%**\n`
md += `- Average dropdown option match: **${avgOption}%**\n\n`

md += '## Per-Screen Results\n'
for (const r of rows) {
  md += `### ${r.screen}\n`
  md += `- Legacy: \`${r.legacy}\`\n`
  md += `- Current: \`${r.current}\`\n`
  md += `- Field match: **${r.fieldScore}%** (${r.matchedFields}/${r.legacyFieldCount})\n`
  md += `- Dropdown option match: **${r.optionScore}%** (${r.matchedOptions}/${r.legacyOptionCount})\n`
  if (r.missingFields.length) md += `- Missing fields (sample): ${r.missingFields.join(', ')}\n`
  if (r.missingOptions.length) md += `- Missing dropdown options (sample): ${r.missingOptions.join(', ')}\n`
  if (r.error) md += `- Error: ${r.error}\n`
  md += '\n'
}

md += '## Strict Verdict\n'
md += '- Exact same fields/options are **not yet achieved** across screens.\n'
md += '- Use this report to implement one screen at a time until each reaches 100% field + option match.\n'

await fs.writeFile(OUT_MD, md)

const csv = [
  'screen,legacy_route,current_route,legacy_field_count,current_field_count,matched_fields,field_match_percent,legacy_option_count,current_option_count,matched_options,option_match_percent,missing_fields_sample,missing_options_sample,error',
  ...rows.map((r) => [
    r.screen,
    r.legacy,
    r.current,
    r.legacyFieldCount,
    r.currentFieldCount,
    r.matchedFields,
    r.fieldScore,
    r.legacyOptionCount,
    r.currentOptionCount,
    r.matchedOptions,
    r.optionScore,
    r.missingFields.join(' | '),
    r.missingOptions.join(' | '),
    r.error,
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
]

await fs.writeFile(OUT_CSV, csv.join('\n'))

console.log({
  screens: rows.length,
  avgField,
  avgOption,
  lowFieldScreens: rows.filter((r) => r.fieldScore < 70).length,
  lowOptionScreens: rows.filter((r) => r.optionScore < 70).length,
})

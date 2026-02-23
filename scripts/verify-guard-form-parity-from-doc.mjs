import fs from 'fs/promises'
import path from 'path'

const DOC = 'docs/erp-form-fields-from-screens.md'
const OUT_MD = 'docs/guard-form-replication-audit.md'
const OUT_CSV = 'docs/guard-form-replication-audit.csv'

const targets = [
  { screen: 'Add Guard', heading: 'Add Guard Screen (FORMS)', route: '/guards/new', files: ['src/app/(dashboard)/guards/new/form.tsx'] },
  { screen: 'Search Guard', heading: 'Search Guard Screen', route: '/guards/search', files: ['src/app/(dashboard)/guards/search/manager.tsx'] },
  { screen: 'Export Guard', heading: 'Export Guards to Excel', route: '/guards/export', files: ['src/app/(dashboard)/guards/export/manager.tsx'] },
  { screen: 'Prerequisites', heading: 'Prerequisites Selection and Activation (Super Admin)', route: '/guards/prerequisites', files: ['src/app/(dashboard)/guards/prerequisites/manager.tsx'] },
  { screen: 'Black Listed Guards', heading: 'Black Listed Guards', route: '/guards/blacklist', files: ['src/app/(dashboard)/guards/blacklist/manager.tsx'] },
  { screen: 'Inactive Guards', heading: 'Inactive Guards', route: '/guards/inactive', files: ['src/app/(dashboard)/guards/inactive/manager.tsx'] },
  { screen: 'Deploy Guards', heading: 'Deploy Guard Screen', route: '/guards/deploy', files: ['src/app/(dashboard)/guards/deploy/form.tsx'] },
  { screen: 'Deployment Rate', heading: 'Deployment Rates Setting', route: '/guards/deployments-rate', files: ['src/app/(dashboard)/guards/deployments-rate/form.tsx'] },
  { screen: 'Guard Attendance', heading: 'Guard Attendance', route: '/guards/attendance', files: ['src/app/(dashboard)/guards/attendance/manager.tsx'] },
  { screen: 'Client Attendance', heading: 'Client Attendance', route: '/guards/client-attendance', files: ['src/app/(dashboard)/guards/client-attendance/manager.tsx'] },
  { screen: 'Residences', heading: 'Guard Residencies List', route: '/guards/residences', files: ['src/app/(dashboard)/guards/residences/manager.tsx'] },
  { screen: 'Assign Residence', heading: 'Assign Residency to Guard', route: '/guards/assign-residence', files: ['src/app/(dashboard)/guards/assign-residence/form.tsx'] },
  { screen: 'On Job Trainings', heading: 'Guard Training Module (Onjob Trainings)', route: '/guards/trainings', files: ['src/app/(dashboard)/guards/trainings/manager.tsx'] },
]

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()
const norm = (s) => clean(s).toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9#*+\-]+/g, ' ').replace(/\s+/g, ' ').trim()

function uniqueNorm(arr) {
  const m = new Map()
  for (const v of arr) {
    const n = norm(v)
    if (!n) continue
    if (!m.has(n)) m.set(n, clean(v))
  }
  return m
}

function parseFieldsForHeading(md, heading) {
  const h = `### ${heading}`
  const i = md.indexOf(h)
  if (i === -1) return []
  const tail = md.slice(i)
  const j = tail.indexOf('\n### ', 4)
  const section = j === -1 ? tail : tail.slice(0, j)
  const m = section.match(/- Fields observed: ([\s\S]*?)\n- Primary actions:/)
  if (!m) return []
  const raw = m[1]
  const values = Array.from(raw.matchAll(/`([^`]+)`/g)).map((x) => x[1])
  if (values.length) {
    // If one backtick list item includes commas, split
    if (values.length === 1 && values[0].includes(',')) {
      return values[0]
        .split(',')
        .map((x) => clean(x))
        .filter((x) => x && norm(x) !== 'none detected')
    }
    return values.map((x) => clean(x)).filter((x) => x && norm(x) !== 'none detected')
  }
  return raw
    .split(',')
    .map((x) => clean(x))
    .filter((x) => x && norm(x) !== 'none detected')
}

function extractCurrentLabels(source) {
  const out = []
  const regexes = [
    /label\s*=\s*"([^"]{1,220})"/g,
    /label\s*=\s*'([^']{1,220})'/g,
    /label\s*=\s*`([^`]{1,220})`/g,
    /<label[^>]*>([\s\S]*?)<\/label>/g,
    /placeholder\s*=\s*"([^"]{1,220})"/g,
    /placeholder\s*=\s*'([^']{1,220})'/g,
    /placeholder\s*=\s*`([^`]{1,220})`/g,
    /<option[^>]*>([\s\S]*?)<\/option>/g,
    /<button[^>]*>([\s\S]*?)<\/button>/g,
    /["'`]([A-Za-z0-9#*()+\-\/&,:. ]{2,120})["'`]/g,
  ]
  for (const re of regexes) {
    let m
    while ((m = re.exec(source)) !== null) {
      const t = clean(String(m[1]).replace(/<[^>]+>/g, ' '))
      if (t) out.push(t)
    }
  }
  return out
}

const doc = await fs.readFile(DOC, 'utf8')
const rows = []

for (const t of targets) {
  const legacyFields = parseFieldsForHeading(doc, t.heading)
  const currentFieldsRaw = []
  for (const f of t.files) {
    try {
      const src = await fs.readFile(path.resolve(f), 'utf8')
      currentFieldsRaw.push(...extractCurrentLabels(src))
    } catch {}
  }

  const legacy = uniqueNorm(legacyFields)
  const current = uniqueNorm(currentFieldsRaw)

  const matched = []
  const missing = []
  for (const [k, v] of legacy.entries()) {
    if (current.has(k)) matched.push(v)
    else missing.push(v)
  }

  const pct = legacy.size ? Number(((matched.length / legacy.size) * 100).toFixed(1)) : 100
  rows.push({
    screen: t.screen,
    route: t.route,
    legacyCount: legacy.size,
    currentCount: current.size,
    matched: matched.length,
    percent: pct,
    status: pct >= 90 ? 'PASS' : pct >= 60 ? 'PARTIAL' : 'FAIL',
    missing: missing.slice(0, 20),
  })
}

let md = '# Guard Module Form Replication Audit\n\n'
md += `- Source of truth: \`${DOC}\`\n`
md += `- Screens audited: **${rows.length}**\n\n`
md += '| Screen | Current Route | Match | Status |\n|---|---|---:|---|\n'
for (const r of rows) {
  md += `| ${r.screen} | \`${r.route}\` | ${r.percent}% (${r.matched}/${r.legacyCount}) | ${r.status} |\n`
}

md += '\n## Per Screen Gaps\n'
for (const r of rows) {
  md += `\n### ${r.screen}\n`
  md += `- Match: **${r.percent}%** (${r.matched}/${r.legacyCount})\n`
  md += `- Status: **${r.status}**\n`
  if (r.missing.length) md += `- Missing fields (sample): ${r.missing.join(', ')}\n`
}

await fs.writeFile(OUT_MD, md)

const csv = [
  'screen,current_route,legacy_fields,current_fields,matched,match_percent,status,missing_sample',
  ...rows.map((r) => [
    r.screen,
    r.route,
    r.legacyCount,
    r.currentCount,
    r.matched,
    r.percent,
    r.status,
    r.missing.join(' | '),
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
]
await fs.writeFile(OUT_CSV, csv.join('\n'))

console.log({ audited: rows.length, pass: rows.filter((r) => r.status === 'PASS').length, partial: rows.filter((r) => r.status === 'PARTIAL').length, fail: rows.filter((r) => r.status === 'FAIL').length })

import fs from 'fs/promises'
import path from 'path'
import { chromium } from 'playwright'

const BASE_URL = 'https://staging-erp.parwestgroup.com/'
const EMAIL = 'admin@parwestgroup.com'
const PASSWORD = 'admin123@'
const MAX_ROUTES = 70

const OUT_DIR = path.resolve('artifacts/legacy-audit')
const SHOTS_DIR = path.join(OUT_DIR, 'screenshots')

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'page'
}

function uniqBy(arr, keyFn) {
  const seen = new Set()
  const out = []
  for (const item of arr) {
    const k = keyFn(item)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(item)
  }
  return out
}

async function writeProgress(payload) {
  await fs.writeFile(path.join(OUT_DIR, 'legacy-audit.json'), JSON.stringify(payload, null, 2))
}

async function ensureDirs() {
  await fs.mkdir(OUT_DIR, { recursive: true })
  await fs.mkdir(SHOTS_DIR, { recursive: true })
}

async function login(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const emailInput = page.locator('input[type="email"], input[name*="email" i], input[id*="email" i]').first()
  const passInput = page.locator('input[type="password"], input[name*="password" i], input[id*="password" i]').first()
  await emailInput.waitFor({ state: 'visible', timeout: 30000 })
  await emailInput.fill(EMAIL)
  await passInput.fill(PASSWORD)
  const submit = page.locator('button:has-text("Login"), button:has-text("Sign In"), button[type="submit"], input[type="submit"]').first()
  await submit.click()
  await page.waitForTimeout(2500)
  if (page.url().toLowerCase().includes('/login')) throw new Error('Login failed')
}

async function openSidebarSections(page) {
  const candidateTexts = ['DASHBOARD','GUARDS','PAYROLL','CLIENTS','INVENTORY','USERS','TICKETING','SETTINGS','REPORTS','IMPORTS','REQUISITIONS','AUDIT']
  for (const text of candidateTexts) {
    const loc = page.locator(`text=${text}`).first()
    try {
      if (await loc.isVisible({ timeout: 1000 })) {
        await loc.click({ timeout: 1000 })
        await page.waitForTimeout(200)
      }
    } catch {}
  }
}

async function extractMenuLinks(page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
      .map((a) => ({ text: (a.textContent || '').trim().replace(/\s+/g, ' '), href: a.getAttribute('href') || '' }))
      .filter((r) => r.href && !r.href.startsWith('#') && !r.href.toLowerCase().startsWith('javascript'))
  })
}

async function scanPage(page) {
  return page.evaluate(() => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,.page-title,.title')).map((e) => clean(e.textContent)).filter(Boolean)
    const tableHeaders = Array.from(document.querySelectorAll('table thead th')).map((e) => clean(e.textContent)).filter(Boolean)
    const tabLabels = Array.from(document.querySelectorAll('[role="tab"], .nav-tabs li, .tabs li, .tab')).map((e) => clean(e.textContent)).filter(Boolean)
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]')).map((e) => clean(e.textContent || e.value)).filter(Boolean)

    const forms = Array.from(document.querySelectorAll('form, .form-section, .panel, .card')).map((section, idx) => {
      const fields = []
      const controls = Array.from(section.querySelectorAll('input, select, textarea'))
      for (const ctrl of controls) {
        const id = ctrl.getAttribute('id') || ''
        const name = ctrl.getAttribute('name') || ''
        const type = ctrl.getAttribute('type') || ctrl.tagName.toLowerCase()
        let label = ''
        if (id) {
          const lbl = document.querySelector(`label[for="${id.replace(/"/g, '\\"')}"]`)
          if (lbl) label = clean(lbl.textContent)
        }
        if (!label) {
          const wrapLabel = ctrl.closest('label')
          if (wrapLabel) label = clean(wrapLabel.textContent)
        }
        if (!label) {
          const prev = ctrl.previousElementSibling
          if (prev && prev.tagName.toLowerCase() === 'label') label = clean(prev.textContent)
        }
        const placeholder = ctrl.getAttribute('placeholder') || ''
        const required = ctrl.hasAttribute('required') || ctrl.getAttribute('aria-required') === 'true'
        fields.push({ label: label || placeholder || name || id || '(unlabeled)', name, id, type, placeholder, required })
      }
      if (!fields.length) return null
      return { sectionIndex: idx, sectionTitle: clean(section.querySelector('h2,h3,h4,.card-title,.panel-title')?.textContent || ''), fields }
    }).filter(Boolean)

    return {
      url: location.href,
      title: document.title,
      headings: Array.from(new Set(headings)).slice(0, 20),
      tableHeaders: Array.from(new Set(tableHeaders)).slice(0, 40),
      tabLabels: Array.from(new Set(tabLabels)).slice(0, 30),
      buttons: Array.from(new Set(buttons)).slice(0, 60),
      forms,
    }
  })
}

async function main() {
  await ensureDirs()
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()

  const pages = []
  let menuLinks = []

  try {
    await login(page)
    await openSidebarSections(page)

    menuLinks = await extractMenuLinks(page)
    menuLinks = menuLinks
      .map((m) => ({ text: m.text, href: new URL(m.href, page.url()).toString() }))
      .filter((m) => m.href.startsWith('https://staging-erp.parwestgroup.com/'))
      .filter((m) => !m.href.toLowerCase().includes('/logout'))

    menuLinks = uniqBy(menuLinks, (m) => m.href)

    const routeQueue = menuLinks.map((m) => m.href)
    if (!routeQueue.includes('https://staging-erp.parwestgroup.com/dashboard')) routeQueue.unshift('https://staging-erp.parwestgroup.com/dashboard')

    const toVisit = routeQueue.slice(0, MAX_ROUTES)

    for (let i = 0; i < toVisit.length; i++) {
      const url = toVisit[i]
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForTimeout(500)
        const meta = await scanPage(page)
        const shotName = `${String(i + 1).padStart(2, '0')}-${slugify(new URL(url).pathname || 'home')}.png`
        const shotPath = path.join(SHOTS_DIR, shotName)
        await page.screenshot({ path: shotPath, fullPage: true })
        pages.push({ menuUrl: url, finalUrl: page.url(), screenshot: `artifacts/legacy-audit/screenshots/${shotName}`, ...meta })
      } catch (err) {
        pages.push({ menuUrl: url, finalUrl: url, error: String(err) })
      }

      if ((i + 1) % 10 === 0 || i === toVisit.length - 1) {
        await writeProgress({ auditedAt: new Date().toISOString(), baseUrl: BASE_URL, totalMenuLinks: menuLinks.length, visited: i + 1, menuLinks, pages })
      }
    }

    const csvRows = [
      ['menu_url','final_url','title','primary_heading','forms_count','fields_count','tabs_count','table_headers_count','error'].join(','),
      ...pages.map((p) => {
        const title = String(p.title || '').replace(/,/g, ';')
        const heading = String((p.headings || [])[0] || '').replace(/,/g, ';')
        const formsCount = p.forms?.length || 0
        const fieldsCount = (p.forms || []).reduce((n, f) => n + (f.fields?.length || 0), 0)
        const tabsCount = p.tabLabels?.length || 0
        const tableHeadersCount = p.tableHeaders?.length || 0
        const err = String(p.error || '').replace(/,/g, ';')
        return [p.menuUrl || '', p.finalUrl || '', title, heading, formsCount, fieldsCount, tabsCount, tableHeadersCount, err].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
      }),
    ]
    await fs.writeFile(path.join(OUT_DIR, 'legacy-routes.csv'), csvRows.join('\n'))

    console.log(`Audit complete: ${pages.length}/${toVisit.length} visited, ${menuLinks.length} discovered.`)
  } finally {
    await context.close()
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

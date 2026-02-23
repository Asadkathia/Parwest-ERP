import fs from 'fs/promises'
import path from 'path'
import { chromium } from 'playwright'

const BASE_URL = 'https://staging-erp.parwestgroup.com/'
const EMAIL = 'admin@parwestgroup.com'
const PASSWORD = 'admin123@'
const OUT_FILE = 'artifacts/legacy-audit/legacy-audit.json'
const SHOTS_DIR = 'artifacts/legacy-audit/screenshots'

function slugify(input) {
  return String(input || '').toLowerCase().replace(/https?:\/\//g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'page'
}

async function login(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.locator('input[type="email"], input[name*="email" i], input[id*="email" i]').first().fill(EMAIL)
  await page.locator('input[type="password"], input[name*="password" i], input[id*="password" i]').first().fill(PASSWORD)
  await page.locator('button:has-text("Login"), button:has-text("Sign In"), button[type="submit"], input[type="submit"]').first().click()
  await page.waitForTimeout(2500)
}

async function scanPage(page) {
  return page.evaluate(() => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,.page-title,.title')).map((e) => clean(e.textContent)).filter(Boolean)
    const tableHeaders = Array.from(document.querySelectorAll('table thead th')).map((e) => clean(e.textContent)).filter(Boolean)
    const tabLabels = Array.from(document.querySelectorAll('[role="tab"], .nav-tabs li, .tabs li, .tab')).map((e) => clean(e.textContent)).filter(Boolean)
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]')).map((e) => clean(e.textContent || e.value)).filter(Boolean)
    const forms = Array.from(document.querySelectorAll('form, .form-section, .panel, .card')).map((section, idx) => {
      const controls = Array.from(section.querySelectorAll('input, select, textarea'))
      if (!controls.length) return null
      const fields = controls.map((ctrl) => {
        const id = ctrl.getAttribute('id') || ''
        const name = ctrl.getAttribute('name') || ''
        const type = ctrl.getAttribute('type') || ctrl.tagName.toLowerCase()
        const placeholder = ctrl.getAttribute('placeholder') || ''
        return { label: placeholder || name || id || '(unlabeled)', name, id, type, placeholder, required: ctrl.hasAttribute('required') }
      })
      return { sectionIndex: idx, sectionTitle: clean(section.querySelector('h2,h3,h4,.card-title,.panel-title')?.textContent || ''), fields }
    }).filter(Boolean)

    return { url: location.href, title: document.title, headings, tableHeaders, tabLabels, buttons, forms }
  })
}

const data = JSON.parse(await fs.readFile(OUT_FILE, 'utf8'))
const visitedSet = new Set(data.pages.map((p) => {
  try { return new URL(p.menuUrl || p.finalUrl).pathname } catch { return '' }
}).filter(Boolean))

const allPaths = data.menuLinks.map((m) => new URL(m.href).pathname)
const pendingPaths = [...new Set(allPaths)].filter((p) => !visitedSet.has(p))

console.log('Pending:', pendingPaths.length)
if (!pendingPaths.length) process.exit(0)

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()

await login(page)

let counter = data.pages.length
for (const pth of pendingPaths) {
  const url = new URL(pth, BASE_URL).toString()
  counter += 1
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(400)
    const meta = await scanPage(page)
    const shot = `${String(counter).padStart(2, '0')}-${slugify(pth)}.png`
    await page.screenshot({ path: path.join(SHOTS_DIR, shot), fullPage: true })
    data.pages.push({ menuUrl: url, finalUrl: page.url(), screenshot: `artifacts/legacy-audit/screenshots/${shot}`, ...meta })
  } catch (e) {
    data.pages.push({ menuUrl: url, finalUrl: url, error: String(e) })
  }
  await fs.writeFile(OUT_FILE, JSON.stringify(data, null, 2))
}

await context.close(); await browser.close()
console.log('Done. Total pages:', data.pages.length)

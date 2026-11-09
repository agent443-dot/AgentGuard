// Renders every image a script lists into marketing/videos/assets/day-NN/.
// Usage, from the repo root: node marketing/videos/assets/src/render.cjs [day-01 day-02 ...]
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const OUT = path.resolve(__dirname, '..')
// AG_SITE renders another copy of the page, e.g. the one on main: git show origin/main:site/index.html
const SITE = 'file://' + (process.env.AG_SITE || path.join(ROOT, 'site/index.html'))
const CSS = fs.readFileSync(path.join(__dirname, 'brand.css'), 'utf8')
const FONTS =
  'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@600;700;800&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap'

// Logical sizes; deviceScaleFactor 2 doubles them to 1080x1920 and 1920x1080.
const SIZES = { v: [540, 960], h: [960, 540] }

const shots = Object.assign({}, ...fs.readdirSync(__dirname).filter((f) => /^shots-.*\.cjs$/.test(f)).map((f) => require(path.join(__dirname, f))))

const page = (html, size) => `<!doctype html><html class="${size === 'v' ? 'v' : 'h'}"><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONTS}"><style>${CSS}</style></head><body>${html}</body></html>`

// The landing page's loss calculator, set to the launch numbers (D1: cap 20, hot wallet at most 10).
async function launchCaps(p) {
  await p.evaluate(() => {
    for (const [id, v] of [['cap', 20], ['hot', 10], ['vault', 1000]]) {
      const el = document.getElementById(id)
      el.value = String(v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
}

async function card(browser, shot, file) {
  const [width, height] = SIZES[shot.size || 'v']
  const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 })
  await p.setContent(page(shot.html, shot.size || 'v'), { waitUntil: 'networkidle' })
  await p.evaluate(() => document.fonts.ready)
  await p.screenshot({ path: file })
  await p.close()
}

async function site(browser, shot, file) {
  const width = shot.width || 540
  const p = await browser.newPage({ viewport: { width, height: shot.height || 960 }, deviceScaleFactor: 2 })
  await p.goto(SITE, { waitUntil: 'networkidle' })
  // The sticky header would sit on top of every section shot.
  if (shot.sel) await p.addStyleTag({ content: 'header.nav { display: none !important; }' })
  if (shot.setup === 'launchCaps') await launchCaps(p)
  if (shot.click) await p.click(shot.click)
  await p.waitForTimeout(1800)
  if (shot.sel) {
    const el = p.locator(shot.sel).first()
    await el.scrollIntoViewIfNeeded()
    await p.waitForTimeout(600)
    await el.screenshot({ path: file })
  } else {
    await p.screenshot({ path: file })
  }
  await p.close()
}

async function main() {
  const days = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(shots)
  const browser = await chromium.launch()
  for (const day of days) {
    const dir = path.join(OUT, day)
    fs.mkdirSync(dir, { recursive: true })
    for (const shot of shots[day]) {
      const file = path.join(dir, shot.name + '.png')
      await (shot.html ? card : site)(browser, shot, file)
      console.log(path.relative(ROOT, file))
    }
  }
  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

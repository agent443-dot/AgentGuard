/* eslint-disable @typescript-eslint/no-require-imports, no-console -- a Node script outside the TS packages */
/* global require, __dirname, process, console, document */
// Renders the X visuals: branded cards from cards.cjs and screenshots of site/index.html sections.
// Usage: node marketing/x/assets/_src/render.cjs [day-NN ...]   (no args renders everything)
const path = require('path')
const { chromium } = require('playwright')
const cards = [...require('./cards.cjs'), ...require('./cards-2.cjs')]

const here = __dirname
const assets = path.resolve(here, '..')
const site = path.resolve(here, '../../../../site/index.html')

async function renderCard(page, spec) {
  await page.goto('file://' + path.join(here, 'card.html'))
  await page.evaluate((s) => {
    document.getElementById('eyebrow').textContent = s.eyebrow
    document.getElementById('content').innerHTML = s.html
    if (s.note) document.getElementById('note').textContent = s.note
    if (s.size) {
      const c = document.getElementById('card')
      c.style.width = s.size.width + 'px'
      c.style.height = s.size.height + 'px'
      // X overlaps the avatar on the bottom left of the header, so keep text to the right half.
      c.style.padding = '48px 64px 36px 420px'
    }
  }, spec)
  await page.evaluate(() => document.fonts.ready)
  await page.locator('#card').screenshot({ path: path.join(assets, spec.out) })
}

async function renderSite(page, spec) {
  await page.goto('file://' + site)
  await page.evaluate(() => document.fonts.ready)
  // The site animates sections in on scroll; reveal everything so the shot is not blank.
  await page.addStyleTag({
    content:
      'header,.nav,body>nav{display:none!important} *{animation:none!important;transition:none!important} .reveal,[data-reveal]{opacity:1!important;transform:none!important}',
  })
  const el = page.locator(spec.selector).first()
  await el.scrollIntoViewIfNeeded()
  await page.waitForTimeout(600)
  await el.screenshot({ path: path.join(assets, spec.out) })
}

;(async () => {
  const only = process.argv.slice(2)
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
  })
  const page = await ctx.newPage()
  for (const spec of cards) {
    if (only.length && !only.some((d) => spec.out.startsWith(d))) continue
    if (spec.selector) await renderSite(page, spec)
    else await renderCard(page, spec)
    console.log('rendered', spec.out)
  }
  await browser.close()
})()

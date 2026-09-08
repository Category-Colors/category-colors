// Renders scripts/og-card.html to public/og.png (1200×630, the Open Graph
// size every card consumer crops to).
//
// Playwright isn't a dependency of this app — the card changes about as often
// as the About splash does, so the browser is borrowed for the minute it takes
// rather than installed for good. To regenerate:
//
//   npm run dev                       # the card pulls Geist from node_modules
//   mkdir -p /tmp/og && cd /tmp/og && npm init -y && npm i playwright-core
//   npx playwright install chromium   # if you don't already have a build
//   node <repo>/scripts/build-og.mjs  # run from that dir so the import resolves
//
// CHROME can override the executable path if the cached build isn't found.

import { createRequire } from 'node:module'
import { readdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Resolved from the working directory, not from this file: playwright lives in
// whatever scratch dir you installed it into, and a bare ESM import would only
// ever look beside the repo.
const require = createRequire(`${process.cwd()}/`)
const playwright = await import(pathToFileURL(require.resolve('playwright-core')).href)
const { chromium } = playwright.default ?? playwright

const CACHE = `${process.env.HOME}/Library/Caches/ms-playwright`

async function findChrome() {
  if (process.env.CHROME) return process.env.CHROME
  const builds = (await readdir(CACHE))
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort((a, b) => Number(a.slice(9)) - Number(b.slice(9)))
  const latest = builds.at(-1)
  if (!latest) throw new Error(`no chromium build under ${CACHE}; set CHROME`)
  return `${CACHE}/${latest}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
}

const out = fileURLToPath(new URL('../public/og.png', import.meta.url))
const browser = await chromium.launch({ executablePath: await findChrome() })
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.goto('http://localhost:5174/scripts/og-card.html', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.locator('.og').screenshot({ path: out })
await browser.close()
console.log(`wrote ${out}`)

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

// What agents and crawlers get without running the app: the Markdown
// negotiation middleware, llms.txt, the sitemap, and the homepage's raw HTML.
export async function testAgents(server) {
  const { onRequest, prefersMarkdown } = await server.ssrLoadModule('/functions/_middleware.ts')

  assert.equal(prefersMarkdown('text/markdown'), true)
  assert.equal(prefersMarkdown('text/markdown, text/html;q=0.9'), true)
  assert.equal(prefersMarkdown('text/html, text/markdown;q=0.5'), false)
  // A browser's Accept header, which reaches Markdown only through */*
  assert.equal(prefersMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'), false)
  assert.equal(prefersMarkdown('*/*'), false)
  assert.equal(prefersMarkdown(null), false)
  assert.equal(prefersMarkdown('text/markdown;q=0'), false)

  const llms = await read('public/llms.txt')
  const html = '<!doctype html><title>Category Colors</title>'
  const env = { ASSETS: { fetch: async (url) => (url.pathname === '/llms.txt' ? new Response(llms) : new Response('', { status: 404 })) } }
  const page = (status, body = html) => async () => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', Vary: 'Accept-Encoding' } })
  const request = (path, accept, method = 'GET') =>
    new Request(`https://categorycolors.com${path}`, { method, headers: accept ? { Accept: accept } : {} })

  let response = await onRequest({ request: request('/', 'text/markdown'), next: page(200), env })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Content-Type'), 'text/markdown; charset=utf-8')
  assert.equal(response.headers.get('Vary'), 'Accept')
  assert.equal(await response.text(), llms)

  response = await onRequest({ request: request('/', 'text/html'), next: page(200), env })
  assert.match(response.headers.get('Content-Type'), /^text\/html/)
  assert.match(response.headers.get('Vary'), /Accept-Encoding, Accept/)
  assert.equal(await response.text(), html)

  response = await onRequest({ request: request('/no-such-page', 'text/markdown'), next: page(404), env })
  assert.equal(response.status, 404)
  assert.equal(response.headers.get('Content-Type'), 'text/markdown; charset=utf-8')
  const body = await response.text()
  assert.ok(body.length >= 20)
  assert.match(body, /\/no-such-page/)
  assert.match(body, /\(https:\/\/categorycolors\.com\/llms\.txt\)/)

  response = await onRequest({ request: request('/no-such-page', 'text/html'), next: page(404), env })
  assert.equal(response.status, 404)
  assert.match(response.headers.get('Content-Type'), /^text\/html/)
  assert.match(response.headers.get('Vary'), /Accept/)

  // Everything else passes through untouched: the weather API, other methods,
  // and pages that exist.
  const untouched = new Response('{}', { headers: { 'Content-Type': 'application/json' } })
  for (const [path, method] of [['/api/weather', 'GET'], ['/', 'POST'], ['/design-system', 'GET']]) {
    response = await onRequest({ request: request(path, 'text/markdown', method), next: async () => untouched, env })
    assert.equal(response, untouched, `${method} ${path} should pass through`)
  }

  // llms.txt follows llmstxt.org: an H1, a blockquote summary, H2 sections of
  // links, and the when-to-use guidance the audit looks for.
  assert.match(llms, /^# Category Colors\n\n> \S/)
  assert.match(llms, /\n## When to use this\n/)
  assert.match(llms, /\n## Docs\n\n- \[[^\]]+\]\(https:\/\/[^)]+\)/)
  for (const tool of ['generate_palette', 'load_preset_palette', 'set_palette', 'check_palette', 'export_palette', 'get_current_palette']) {
    assert.ok(llms.includes(`\`${tool}\``), `llms.txt should name ${tool}`)
  }

  const sitemap = await read('public/sitemap.xml')
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
  assert.match(sitemap, /<loc>https:\/\/categorycolors\.com\/<\/loc>\s*<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/)
  assert.match(await read('public/robots.txt'), /^Sitemap: https:\/\/categorycolors\.com\/sitemap\.xml$/m)
  // The WebMCP origin trial token rides on the document. It has to name this
  // origin and the WebMCP feature, or Chrome ignores it silently.
  const headers = await read('public/_headers')
  for (const path of ['/', '/index.html']) {
    const block = headers.split(/\n(?=\S)/).find((b) => b.split('\n')[0] === path)
    const token = block?.match(/^ {2}Origin-Trial: (\S+)$/m)?.[1]
    assert.ok(token, `${path} is missing its Origin-Trial header`)
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8').replace(/^[\s\S]*?(?=\{"origin")/, ''))
    assert.equal(payload.origin, 'https://categorycolors.com:443')
    assert.equal(payload.feature, 'WebMCP')
  }
  const routes = JSON.parse(await read('public/_routes.json'))
  assert.ok(routes.include.includes('/*') && routes.exclude.includes('/assets/*'))

  // The homepage's raw HTML: one H1, sequential headings, enough text to
  // describe the app, and JSON-LD that parses.
  const index = await read('index.html')
  const fallback = index.match(/<main class="static-fallback">([\s\S]*?)<\/main>/)[1]
  const text = fallback.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  assert.ok(text.length >= 500, `fallback text is ${text.length} characters`)
  assert.equal(index.match(/<h1[\s>]/g).length, 1)
  assert.deepEqual(fallback.match(/<h(\d)/g), ['<h1', '<h2', '<h2'])
  const jsonLd = JSON.parse(index.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
  assert.equal(jsonLd['@type'], 'SoftwareApplication')
  for (const key of ['name', 'description', 'url', 'offers', 'author', 'sameAs']) assert.ok(jsonLd[key], `JSON-LD is missing ${key}`)

  console.log('Agent-readiness checks passed.')
}

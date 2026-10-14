import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// The remote MCP server through its Pages Function entry, with requests shaped
// the way 2026-07-28 and 2025-era clients send them.
export async function testMcp(server) {
  const { onRequest } = await server.ssrLoadModule('/functions/mcp.ts')
  const env = { MCP_ENABLED: 'true' }
  const call = async (request, environment = env) => onRequest({ request, env: environment })
  const post = (headers, body) => new Request('https://categorycolors.com/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, ...body }),
  })
  const modern = (method, params = {}) => post(
    { 'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': method, ...(params.name ? { 'Mcp-Name': params.name } : {}) },
    { method, params: { ...params, _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} } } },
  )
  const result = async (request) => {
    const response = await call(request)
    assert.equal(response.status, 200)
    const text = await response.text()
    return JSON.parse(text.startsWith('event:') ? text.match(/^data: (.*)$/m)[1] : text).result
  }
  const tool = async (name, args) => result(modern('tools/call', { name, arguments: args }))

  // The off switch: anything but MCP_ENABLED=true and the endpoint doesn't exist
  for (const off of [{}, { MCP_ENABLED: 'false' }]) assert.equal((await call(modern('tools/list'), off)).status, 404)
  // A browser page elsewhere can't call it
  const foreign = modern('tools/list')
  foreign.headers.set('Origin', 'https://evil.example')
  assert.equal((await call(foreign)).status, 403)

  assert.deepEqual((await result(modern('server/discover'))).supportedVersions.includes('2026-07-28'), true)
  const { tools } = await result(modern('tools/list'))
  assert.deepEqual(tools.map((t) => t.name).sort(), ['check_palette', 'export_palette', 'generate_palette', 'get_preset_palette'])
  for (const t of tools) {
    assert.equal(t.annotations.readOnlyHint, true, t.name)
    assert.equal(t.outputSchema.type, 'object', t.name)
  }
  assert.equal(tools.find((t) => t.name === 'generate_palette').inputSchema.properties.config.type, 'object')

  // Results come as structured content plus the same JSON as text
  let out = await tool('check_palette', { colors: ['#E69F00', '#56B4E9', 'red'], jnd: 30 })
  assert.deepEqual(JSON.parse(out.content[0].text), out.structuredContent)
  assert.equal(out.structuredContent.report.jndThreshold, 30)
  assert.equal(out.structuredContent.colors[2].hex, '#FF0000')
  assert.match(out.structuredContent.link, /^https:\/\/categorycolors\.com\/\?colors=%23E69F00,%2356B4E9,red#config=/)
  // Bad arguments come back as a result the agent can read, naming what's wrong
  out = await tool('check_palette', { colors: ['red', 'blurple'] })
  assert.equal(out.isError, true)
  assert.match(out.content[0].text, /"blurple"/)

  out = await tool('get_preset_palette', { name: 'Okabe–Ito' })
  assert.equal(out.structuredContent.colors.length, 8)
  assert.match(out.structuredContent.link, /^https:\/\/categorycolors\.com\/\?p=H/)
  out = await tool('export_palette', { colors: ['#E69F00', 'oklch(0.7 0.1 30)'], format: 'css' })
  assert.match(out.structuredContent.text, /--palette-1: #E69F00;\n  --palette-2: oklch\(0\.7 0\.1 30\);/)

  out = await tool('generate_palette', { colorCount: 3, fixedColors: ['#DB563C'] })
  const colors = out.structuredContent.colors.map((c) => c.css)
  assert.equal(colors.length, 3)
  assert.ok(colors.some((c) => c.toUpperCase() === '#DB563C'), colors.join())
  assert.ok(colors.filter((c) => c.startsWith('oklch(')).length >= 2, colors.join())
  assert.equal(out.structuredContent.config.colorCount, 3)
  assert.equal(typeof out.structuredContent.cost, 'number')
  assert.equal(out.structuredContent.runs, 1)
  assert.ok(Number.isSafeInteger(out.structuredContent.seed))
  // The same config and seed make the same palette; the seed comes back
  const fast = { colorCount: 3, config: { maxIterations: 1000 }, seed: 7 }
  const [a, b] = await Promise.all([tool('generate_palette', fast), tool('generate_palette', fast)])
  assert.deepEqual(a.structuredContent.colors, b.structuredContent.colors)
  assert.equal(a.structuredContent.seed, 7)
  assert.notDeepEqual((await tool('generate_palette', { ...fast, seed: 8 })).structuredContent.colors, a.structuredContent.colors)
  // The full config, with the shortcuts over it
  out = await tool('generate_palette', { config: { colorCount: 5, jnd: 12, maxIterations: 1000, colorSpace: { mode: 'oklch', ranges: [[0.3, 0.5], [0.02, 0.1], [0, 360]] } }, colorCount: 2 })
  assert.equal(out.structuredContent.colors.length, 2)
  assert.equal(out.structuredContent.config.jnd, 12)
  assert.equal(out.structuredContent.config.colorSpace.mode, 'oklch')
  assert.equal(out.structuredContent.report.jndThreshold, 12)

  // A 2025-era client: initialize, then a sessionless call
  const init = await result(post({}, { method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } }))
  assert.equal(init.serverInfo.name, 'category-colors')
  const legacy = await result(post({ 'MCP-Protocol-Version': '2025-06-18' }, { method: 'tools/call', params: { name: 'export_palette', arguments: { colors: ['red'], format: 'raw' } } }))
  assert.equal(legacy.structuredContent.text.trim(), 'red')

  // Rate limits, with a stand-in for workers/limits that allows `quota` calls
  // per action and client IP
  const seen = []
  const limited = (quota) => ({ ...env, LIMITS: { allow: async (action, key) => (seen.push(`${action} ${key}`), seen.filter((s) => s === `${action} ${key}`).length <= quota) } })
  const from = (ip, request) => (request.headers.set('CF-Connecting-IP', ip), request)
  const generate = (args) => modern('tools/call', { name: 'generate_palette', arguments: args })
  // Past the request limit an IP gets 429
  const strict = limited(2)
  assert.equal((await call(from('1.1.1.1', modern('tools/list')), strict)).status, 200)
  assert.equal((await call(from('1.1.1.1', modern('tools/list')), strict)).status, 200)
  const response = await call(from('1.1.1.1', modern('tools/list')), strict)
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('Retry-After'), '60')
  assert.equal((await call(from('2.2.2.2', modern('tools/list')), strict)).status, 200)
  // Past the generation limit, generate_palette says so in a result the agent
  // can read; bad arguments don't use up the quota, and other tools still work
  seen.length = 0
  const once = limited(100)
  once.LIMITS.allow = async (action, key) => (seen.push(`${action} ${key}`), action !== 'generate' || seen.filter((s) => s === `generate ${key}`).length <= 1)
  const read = async (request) => JSON.parse((await (await call(request, once)).text()).replace(/^event:[\s\S]*?^data: /m, '')).result
  assert.equal((await read(from('3.3.3.3', generate({ colorCount: 99 })))).isError, true)
  assert.equal(seen.filter((s) => s.startsWith('generate')).length, 0)
  assert.equal((await read(from('3.3.3.3', generate({ colorCount: 2 })))).structuredContent.colors.length, 2)
  out = await read(from('3.3.3.3', generate({ colorCount: 2 })))
  assert.equal(out.isError, true)
  assert.match(out.content[0].text, /Too many palettes/)
  assert.equal((await read(from('3.3.3.3', modern('tools/call', { name: 'export_palette', arguments: { colors: ['red'], format: 'raw' } })))).isError, undefined)
  assert.deepEqual(seen.filter((s) => s.startsWith('generate')), ['generate 3.3.3.3', 'generate 3.3.3.3'])
  // runs: n spends one generation per run and keeps the cheapest; past the
  // limit it returns what it has
  seen.length = 0
  const twice = limited(100)
  twice.LIMITS.allow = async (action, key) => (seen.push(`${action} ${key}`), action !== 'generate' || seen.filter((s) => s === `generate ${key}`).length <= 2)
  out = JSON.parse((await (await call(from('4.4.4.4', generate({ colorCount: 2, runs: 3, config: { maxIterations: 1000 } })), twice)).text()).replace(/^event:[\s\S]*?^data: /m, '')).result
  assert.equal(out.isError, undefined)
  assert.equal(out.structuredContent.runs, 2)
  assert.equal(seen.filter((s) => s === 'generate 4.4.4.4').length, 3)
  // and the winning run's seed is the one reported
  out = await tool('generate_palette', { colorCount: 2, runs: 2, seed: 100, config: { maxIterations: 1000 } })
  assert.ok([100, 101].includes(out.structuredContent.seed))
  assert.deepEqual((await tool('generate_palette', { colorCount: 2, seed: out.structuredContent.seed, config: { maxIterations: 1000 } })).structuredContent.colors, out.structuredContent.colors)

  // Production has the limits bound, a CPU cap, and the limits Worker declares
  // what the endpoint asks for
  const jsonc = async (path) => JSON.parse((await readFile(new URL(`../${path}`, import.meta.url), 'utf8')).replace(/^\s*\/\/.*$/gm, ''))
  const site = await jsonc('wrangler.jsonc')
  assert.equal(site.vars.MCP_ENABLED, 'true')
  assert.deepEqual(site.services, [{ binding: 'LIMITS', service: 'category-colors-limits' }])
  assert.ok(site.limits.cpu_ms >= 2000)
  const worker = await jsonc('workers/limits/wrangler.jsonc')
  assert.equal(worker.name, 'category-colors-limits')
  assert.deepEqual(worker.durable_objects.bindings, [{ name: 'COUNTERS', class_name: 'Counter' }])

  console.log('MCP server checks passed.')
}

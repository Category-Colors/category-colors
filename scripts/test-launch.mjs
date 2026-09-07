import assert from 'node:assert/strict'
import { converter, interpolate, formatHex, wcagContrast } from 'culori'

export async function testLaunch(server) {
  const session = await server.ssrLoadModule('/src/lib/session.ts')
  const { DEFAULT_PARAMS } = await server.ssrLoadModule('/src/lib/palette.ts')
  const { parsePalette, formatPalette } = await server.ssrLoadModule('/src/lib/exporters.ts')
  const { reportTextColors } = await server.ssrLoadModule('/src/lib/contrast.ts')
  const { THEME_PRESETS } = await server.ssrLoadModule('/src/lib/theme.ts')
  const version = (id) => ({ id, params: structuredClone(DEFAULT_PARAMS), colors: ['#ff0000', 'oklch(0.7 0.3 140)'], cost: 0.3, iterations: 2000, costHistory: [[0, 1], [2000, 0.3]], createdAt: 1000, edited: true })
  const state = { params: structuredClone(DEFAULT_PARAMS), versions: [version(4)], currentId: 4 }
  let restored = session.parseSession(session.serializeSession(state))
  assert.equal(restored.currentId, 4)
  assert.deepEqual(restored.versions[0].colors, state.versions[0].colors)
  assert.equal(restored.versions[0].edited, true)
  const many = { ...state, versions: Array.from({ length: 60 }, (_, i) => version(i + 1)), currentId: 2 }
  restored = session.parseSession(session.serializeSession(many))
  assert.equal(restored.versions.length, 30)
  assert.equal(restored.currentId, 2)
  assert.ok(restored.versions.some((v) => v.id === 60))
  const dense = { ...state, versions: [{ ...version(1), costHistory: Array.from({ length: 2000 }, (_, i) => [i, 1 / (i + 1)]) }], currentId: 1 }
  restored = session.parseSession(session.serializeSession(dense))
  assert.equal(restored.versions[0].costHistory.length, 512)
  assert.deepEqual(restored.versions[0].costHistory.at(-1), dense.versions[0].costHistory.at(-1))
  assert.equal(session.parseSession('{'), null)
  assert.equal(session.parseSession(JSON.stringify({ schema: 2, ...state })), null)
  assert.equal(session.parseSession(JSON.stringify({ schema: 1, ...state, versions: [version(4), version(4)] })), null)
  assert.equal(session.parseSession(JSON.stringify({ schema: 1, ...state, versions: [{ ...version(4), colors: ['not a color'] }] })), null)
  assert.equal(session.parseSession('x'.repeat(2_000_001)), null)

  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  let stored = null
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: () => stored, setItem: (_key, value) => { stored = value },
    } })
    assert.equal(session.saveSession(state), true)
    assert.equal(session.loadSession().session.currentId, 4)
    assert.equal(session.saveSession(session.emptySession()), true)
    assert.equal(session.loadSession().session.versions.length, 0, 'Cleared history stays cleared')
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('storage blocked') } })
    assert.equal(session.saveSession(state), false)
    assert.ok(session.loadSession().warning)
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
    else delete globalThis.localStorage
  }

  const toLab = converter('oklab')
  const closeColor = (a, b) => {
    const x = toLab(a), y = toLab(b)
    assert.ok(Math.hypot(x.l - y.l, x.a - y.a, x.b - y.b) < 0.0002, `${a} ≠ ${b}`)
  }
  const wide = 'oklch(0.72 0.31 140.1234)'
  for (const format of ['raw', 'css', 'json']) closeColor(parsePalette(formatPalette([wide], format))[0], wide)
  closeColor(parsePalette('color(display-p3 0 1 0)')[0], 'color(display-p3 0 1 0)')
  const tokens = { palette: { $type: 'color', vivid: { $value: { colorSpace: 'display-p3', components: [0, 1, 0] } }, alias: { $value: '{palette.vivid}' } } }
  const imported = parsePalette(JSON.stringify(tokens))
  assert.equal(imported.length, 2)
  imported.forEach((c) => closeColor(c, 'color(display-p3 0 1 0)'))
  assert.equal(parsePalette(':root { --one: red; --two: #fff; --three: blue; }').length, 3)
  assert.throws(() => parsePalette(JSON.stringify({ a: { $type: 'color', $value: '{a}' } })), /Circular/)
  // Transparency is fatal only when dropping it leaves nothing: someone who
  // pastes one translucent color needs to be told why, but a theme file whose
  // palette is fine should not be refused over an unrelated --shadow.
  assert.throws(() => parsePalette(JSON.stringify({ a: { $type: 'color', $value: { colorSpace: 'srgb', components: [1, 0, 0], alpha: 0.5 } } })), /opaque/)
  assert.throws(() => parsePalette('rgba(255, 0, 0, 0.5)'), /opaque/)
  assert.deepEqual(parsePalette(':root { --a:#ff0000; --b:rgba(0,0,0,0.4); --c:#00ff00; }'), ['#FF0000', '#00FF00'])
  // A string $value is the older, and still commonest, DTCG spelling; a plain
  // JSON colour map is not a token file at all and falls through to scanning.
  assert.deepEqual(parsePalette(JSON.stringify({ brand: { $type: 'color', primary: { $value: '#4269D0' }, secondary: { $value: '#EFB118' } } })), ['#4269D0', '#EFB118'])
  assert.deepEqual(parsePalette(JSON.stringify({ primary: '#ff0000', secondary: '#00ff00' })), ['#FF0000', '#00FF00'])

  for (const t of [...THEME_PRESETS.flatMap((p) => Object.values(p.modes)), { bg: '#777777', panel: '#777777', ink: '#888888', danger: '#ff0000' }, { bg: '#ffffff', panel: '#ffffff', ink: '#ffffff', danger: '#ffffff' }]) {
    const text = reportTextColors(t.bg, t.ink, t.danger)
    const card = formatHex(interpolate([t.bg, t.ink], 'rgb')(0.05))
    for (const color of Object.values(text)) for (const background of [t.bg, card]) assert.ok(wcagContrast(color, background) >= 4.5)
  }

  const { onRequest } = await server.ssrLoadModule('/functions/api/weather.ts')
  const originalFetch = globalThis.fetch
  const originalCaches = globalThis.caches
  const cache = new Map()
  let calls = 0
  let waits = []
  const context = (env = { WEATHER_NON_COMMERCIAL: 'true' }) => ({ request: new Request('https://categorycolors.com/api/weather?latitude=999'), env, waitUntil: (task) => waits.push(task) })
  try {
    globalThis.caches = { open: async () => ({ match: async (request) => cache.get(request.url)?.clone(), put: async (request, response) => { cache.set(request.url, response) } }) }
    globalThis.fetch = async (url, options) => {
      calls++
      assert.equal(new URL(url).searchParams.get('latitude').split(',').length, 20)
      assert.ok(options.signal instanceof AbortSignal)
      return Response.json(Array(20).fill({ hourly: {}, daily: {} }))
    }
    assert.equal((await onRequest(context({}))).status, 503)
    assert.equal(calls, 0)
    const result = await onRequest(context())
    assert.equal(result.status, 200)
    assert.match(result.headers.get('Cache-Control'), /max-age=600/)
    await Promise.all(waits)
    assert.equal((await onRequest(context())).status, 200)
    assert.equal(calls, 1, 'Cached forecasts avoid a second upstream call')
    cache.clear()
    globalThis.fetch = async () => { throw new Error('secret-api-key') }
    const failure = await onRequest(context({ OPEN_METEO_API_KEY: 'secret-api-key' }))
    assert.equal(failure.status, 502)
    assert.ok(!(await failure.text()).includes('secret-api-key'))
    assert.equal((await onRequest({ ...context(), request: new Request('https://categorycolors.com/api/weather', { method: 'POST' }) })).status, 405)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.caches = originalCaches
  }
  const originalWorker = globalThis.Worker
  const workers = []
  try {
    globalThis.Worker = class {
      listeners = new Map()
      terminated = false
      constructor() { workers.push(this) }
      addEventListener(name, fn) { this.listeners.set(name, fn) }
      postMessage(message) { this.requestId = message.requestId }
      terminate() { this.terminated = true }
    }
    const generation = await server.ssrLoadModule('/src/lib/generate.ts')
    const cancelled = generation.generatePaletteAsync(DEFAULT_PARAMS)
    const rejection = assert.rejects(cancelled, { name: 'AbortError' })
    generation.cancelPaletteGeneration()
    await rejection
    assert.equal(workers[0].terminated, true)
    const retry = generation.generatePaletteAsync(DEFAULT_PARAMS)
    assert.equal(workers.length, 2)
    const result = { colors: ['#000000', '#ffffff'], cost: 0, iterations: 1, costHistory: [] }
    workers[1].listeners.get('message')({ data: { ok: true, requestId: workers[1].requestId, result } })
    assert.deepEqual(await retry, result)
    generation.cancelPaletteGeneration()
  } finally { globalThis.Worker = originalWorker }
  console.log('Launch regression checks passed.')
}

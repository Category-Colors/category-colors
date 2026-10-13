import { parseCssColor } from './color'
import { parseParams, type PaletteParams } from './palette'

// A link to the app's state: the palette in `?colors=`, each color exactly as
// stored (any CSS notation, every digit), and the Configure panel in
// `#config=` as the settings that differ from LINK_BASE, deflated. The colors
// stay readable so a person or an agent can write a link by hand; the hash
// never reaches the server.
//
// LINK_BASE is the defaults as of 2026-10-12, copied rather than imported from
// DEFAULT_PARAMS. A link leaves out whatever matched the base, so if the base
// moved, old links would silently pick up the new values. When the app's
// defaults change, links only get longer. Never edit this.
const evaluator = { cvd: 'deuteranomaly', cvdSeverity: 0.5, background: '#ffffff', ratio: 3, checkAdjacent: false, avoidRadius: 0.15, avoidColors: [] }
const LINK_BASE = {
  colorCount: 8,
  jnd: 20,
  maxIterations: 60000,
  orderOptimization: true,
  initColors: [],
  targets: [],
  evaluators: [
    { ...evaluator, type: 'energy', weight: 0.15 },
    { ...evaluator, type: 'range', weight: 0.15 },
    { ...evaluator, type: 'jnd', weight: 1 },
    { ...evaluator, type: 'cvd', weight: 0.1, cvd: 'protanomaly', cvdSeverity: 1 },
    { ...evaluator, type: 'cvd', weight: 0.1, cvd: 'deuteranomaly', cvdSeverity: 1 },
    { ...evaluator, type: 'cvd', weight: 0.1, cvd: 'tritanomaly', cvdSeverity: 1 },
    { ...evaluator, type: 'cvd', weight: 0.05, cvd: 'grayscale' },
  ],
  colorSpace: { mode: 'okhsl', ranges: [[0, 360], [0.2, 0.8], [0.3, 0.9]] },
} as Record<string, unknown>

const MAX_COLORS = 256
// A few hundred bytes of hash can inflate to gigabytes; nothing real is near this
const MAX_CONFIG_LENGTH = 1_000_000

// For comparing settings: key order and hex case don't matter (the import
// validator uppercases what the defaults spell in lowercase), and ids are
// per-session row keys rather than settings
const canonical = (value: unknown) =>
  JSON.stringify(value, (key, v) =>
    key === 'id' ? undefined
    : typeof v === 'string' && /^#[0-9a-f]+$/i.test(v) ? v.toLowerCase()
    : v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort())
    : v
  )

const deflate = async (text: string) =>
  new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())

async function inflate(bytes: Uint8Array<ArrayBuffer>) {
  const reader = new Blob([bytes]).stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
    .pipeThrough(new TextDecoderStream())
    .getReader()
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return text
    text += value
    if (text.length > MAX_CONFIG_LENGTH) {
      reader.cancel()
      throw new Error('Linked configuration is too large')
    }
  }
}

const toBase64Url = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromBase64Url = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

// The path, query and hash for this state; just `path` when there is nothing to share
export async function linkFor(colors: string[], params: PaletteParams, path = '/'): Promise<string> {
  const current = JSON.parse(canonical(params)) as Record<string, unknown>
  const changed = Object.fromEntries(Object.entries(current).filter(([key, value]) => canonical(value) !== canonical(LINK_BASE[key])))
  // encodeURIComponent escapes the commas inside rgb(1, 2, 3), so only the separators stay literal
  const query = colors.length ? `?colors=${colors.map(encodeURIComponent).join(',')}` : ''
  const hash = Object.keys(changed).length ? `#config=${toBase64Url(await deflate(JSON.stringify(changed)))}` : ''
  return path + query + hash
}

// What a link carries, or null when it carries nothing. A link without
// `#config=` means the defaults, and one that can't be read falls back to them
// rather than losing the colors.
export async function readLink(url: { search: string; hash: string }): Promise<{ colors: string[]; params: PaletteParams } | null> {
  const raw = new URLSearchParams(url.search).get('colors')
  const config = url.hash.match(/^#config=([\w-]+)$/)?.[1]
  if (!raw && !config) return null
  // Split on commas outside parentheses, so hand-written links can leave rgb(1, 2, 3) unescaped
  const colors = (raw ?? '')
    .split(/,(?![^(]*\))/)
    .map((c) => c.trim())
    .filter((c) => c.length < 200 && parseCssColor(c))
    .slice(0, MAX_COLORS)
  let changed: unknown = {}
  try {
    if (config) changed = JSON.parse(await inflate(fromBase64Url(config)))
  } catch {
    // unreadable: keep the defaults
  }
  const overrides = changed && typeof changed === 'object' && !Array.isArray(changed) ? changed : {}
  const params = parseParams(JSON.stringify({ ...LINK_BASE, ...overrides })) ?? parseParams(JSON.stringify(LINK_BASE))!
  return { colors, params }
}

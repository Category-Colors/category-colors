import { parseCssColor } from './color'
import { parseParams, type PaletteParams } from './palette'

// A link to the app's state: the palette in `?p=` (or `?colors=`), and the
// Configure panel in `#config=` as the settings that differ from LINK_BASE,
// deflated. The hash never reaches the server.
//
// Colors come back exactly as stored, notation and every digit. `?p=` packs
// each one as a format letter and its channels in fixed-width base64url, at
// the precision the app writes that notation (9 characters for a generated
// OKLCH color, against about 37 written out). A color the packing can't
// reproduce character for character, such as a hand-typed oklch() with six
// decimals, sends the whole palette as readable `?colors=` instead. People
// and agents writing links by hand use `?colors=`.
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

const DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
type Channel = readonly [read: (text: string) => number, write: (n: number) => string]
const decimal = (scale: number): Channel => [(t) => Math.round(Number(t) * scale), (n) => String(n / scale)]
const hexPair = (upper: boolean): Channel => [(t) => parseInt(t, 16), (n) => {
  const t = n.toString(16).padStart(2, '0')
  return upper ? t.toUpperCase() : t
}]
// Each notation the app writes, with how many values each channel can take
// at that precision. Never change a letter's meaning; add letters instead.
const FORMATS: Record<string, { pattern: RegExp; counts: number[]; channel: Channel; write: (c: string[]) => string }> = {
  o: { pattern: /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/, counts: [10001, 5001, 3600001], channel: decimal(1e4), write: ([l, c, h]) => `oklch(${l} ${c} ${h})` },
  s: { pattern: /^hsl\(([\d.]+) ([\d.]+)% ([\d.]+)%\)$/, counts: [3601, 1001, 1001], channel: decimal(10), write: ([h, s, l]) => `hsl(${h} ${s}% ${l}%)` },
  r: { pattern: /^rgb\((\d+), (\d+), (\d+)\)$/, counts: [256, 256, 256], channel: decimal(1), write: ([r, g, b]) => `rgb(${r}, ${g}, ${b})` },
  H: { pattern: /^#([\dA-F]{2})([\dA-F]{2})([\dA-F]{2})$/, counts: [256, 256, 256], channel: hexPair(true), write: (c) => `#${c.join('')}` },
  h: { pattern: /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/, counts: [256, 256, 256], channel: hexPair(false), write: (c) => `#${c.join('')}` },
}
const width = (counts: number[]) => Math.ceil(Math.log(counts.reduce((a, b) => a * b)) / Math.log(64) - 1e-9)

function unpack(tokens: string): string[] | null {
  const colors = []
  for (let i = 0; i < tokens.length; ) {
    const format = FORMATS[tokens[i]]
    if (!format) return null
    const w = width(format.counts)
    const digits = tokens.slice(i + 1, i + 1 + w)
    if (digits.length !== w) return null
    let n = 0
    for (const d of digits) {
      const v = DIGITS.indexOf(d)
      if (v < 0) return null
      n = n * 64 + v
    }
    const ints = format.counts.map(() => 0)
    for (let c = format.counts.length - 1; c >= 0; c--) {
      ints[c] = n % format.counts[c]
      n = Math.floor(n / format.counts[c])
    }
    if (n !== 0) return null
    colors.push(format.write(ints.map(format.channel[1])))
    i += 1 + w
  }
  return colors
}

function pack(color: string): string | null {
  for (const [letter, format] of Object.entries(FORMATS)) {
    const ints = color.match(format.pattern)?.slice(1).map(format.channel[0])
    if (!ints || ints.some((n, c) => !Number.isInteger(n) || n < 0 || n >= format.counts[c])) continue
    let n = 0
    ints.forEach((v, c) => { n = n * format.counts[c] + v })
    let digits = ''
    for (let d = width(format.counts); d > 0; d--, n = Math.floor(n / 64)) digits = DIGITS[n % 64] + digits
    const token = letter + digits
    if (unpack(token)?.[0] === color) return token
  }
  return null
}

const toBase64Url = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromBase64Url = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

// The path, query and hash for this state; just `path` when there is nothing to share
export async function linkFor(colors: string[], params: PaletteParams, path = '/'): Promise<string> {
  const current = JSON.parse(canonical(params)) as Record<string, unknown>
  const changed = Object.fromEntries(Object.entries(current).filter(([key, value]) => canonical(value) !== canonical(LINK_BASE[key])))
  const packed = colors.map(pack)
  const query = !colors.length ? ''
    : packed.every(Boolean) ? `?p=${packed.join('')}`
    // encodeURIComponent escapes the commas inside rgb(1, 2, 3), so only the separators stay literal
    : `?colors=${colors.map(encodeURIComponent).join(',')}`
  const hash = Object.keys(changed).length ? `#config=${toBase64Url(await deflate(JSON.stringify(changed)))}` : ''
  return path + query + hash
}

// What a link carries, or null when it carries nothing. A link without
// `#config=` means the defaults, and one that can't be read falls back to them
// rather than losing the colors.
export async function readLink(url: { search: string; hash: string }): Promise<{ colors: string[]; params: PaletteParams } | null> {
  const query = new URLSearchParams(url.search)
  const raw = query.get('colors')
  const tokens = query.get('p')
  const config = url.hash.match(/^#config=([\w-]+)$/)?.[1]
  if (!raw && !tokens && !config) return null
  // Split on commas outside parentheses, so hand-written links can leave rgb(1, 2, 3) unescaped
  const colors = (tokens ? unpack(tokens.slice(0, 10 * MAX_COLORS)) ?? [] : (raw ?? '').split(/,(?![^(]*\))/))
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

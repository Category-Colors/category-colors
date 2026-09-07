import { converter, formatCss, parse, type Color } from 'culori'
import { convertValue, parseCssColor, valueToCss, type ColorValue } from './color'

export type ExportFormat = 'raw' | 'css' | 'json'

const round4 = (n: number) => Math.round(n * 10000) / 10000

// DTCG color token $value: structured components in the color's own space
// (sRGB 0–1; HSL saturation/lightness 0–100; OKLCH/OKLAB lightness 0–1),
// with the 6-digit hex fallback the spec allows
function toDtcgValue(value: ColorValue): Record<string, unknown> {
  const hexFallback = (() => {
    const hex = convertValue(value, 'hex')
    return hex.space === 'hex' ? hex.hex.toLowerCase() : undefined
  })()
  switch (value.space) {
    case 'hex': {
      const n = parseInt(value.hex.slice(1, 7), 16)
      return {
        colorSpace: 'srgb',
        components: [round4(((n >> 16) & 255) / 255), round4(((n >> 8) & 255) / 255), round4((n & 255) / 255)],
        hex: value.hex.toLowerCase(),
      }
    }
    case 'rgb':
      return {
        colorSpace: 'srgb',
        components: [round4(value.r / 255), round4(value.g / 255), round4(value.b / 255)],
        hex: hexFallback,
      }
    case 'hsl':
      return { colorSpace: 'hsl', components: [round4(value.h), round4(value.s), round4(value.l)], hex: hexFallback }
    case 'oklch':
      return { colorSpace: 'oklch', components: [round4(value.l), round4(value.c), round4(value.h)], hex: hexFallback }
    case 'oklab':
      return { colorSpace: 'oklab', components: [round4(value.l), round4(value.a), round4(value.b)], hex: hexFallback }
  }
}

const toLab = converter('oklab')

// Preserve perceptual and wide-gamut colors. Plain RGB/named inputs keep the
// familiar hex presentation; unsupported editor spaces convert through OKLAB.
const tokenToColor = (raw: string): string | null => {
  const parsed = parse(raw.trim())
  if (!parsed) return null
  if (parsed.alpha !== undefined && parsed.alpha !== 1) throw new Error('Palettes use opaque colors. Remove transparency before importing.')
  if (parsed.mode === 'rgb') {
    const value = parseCssColor(raw)
    if (!value) return null
    return valueToCss(convertValue(value, 'hex'))
  }
  const value = parseCssColor(raw)
  return value ? valueToCss(value) : null
}

const DTCG_SPACES: Record<string, [Color['mode'], string[]]> = {
  srgb: ['rgb', ['r', 'g', 'b']], 'srgb-linear': ['lrgb', ['r', 'g', 'b']],
  'display-p3': ['p3', ['r', 'g', 'b']], 'a98-rgb': ['a98', ['r', 'g', 'b']],
  'prophoto-rgb': ['prophoto', ['r', 'g', 'b']], rec2020: ['rec2020', ['r', 'g', 'b']],
  hsl: ['hsl', ['h', 's', 'l']], hwb: ['hwb', ['h', 'w', 'b']],
  lab: ['lab', ['l', 'a', 'b']], lch: ['lch', ['l', 'c', 'h']],
  oklab: ['oklab', ['l', 'a', 'b']], oklch: ['oklch', ['l', 'c', 'h']],
  'xyz-d65': ['xyz65', ['x', 'y', 'z']], 'xyz-d50': ['xyz50', ['x', 'y', 'z']],
}

function fromDtcg(value: unknown): string {
  if (!value || typeof value !== 'object') throw new Error('Invalid color token value.')
  const v = value as Record<string, unknown>
  if (v.alpha !== undefined && v.alpha !== 1) throw new Error('Palettes use opaque colors. Remove transparency before importing.')
  const definition = typeof v.colorSpace === 'string' ? DTCG_SPACES[v.colorSpace] : undefined
  if (!definition) throw new Error(`Unsupported token color space: ${String(v.colorSpace)}`)
  if (!Array.isArray(v.components) || v.components.length !== 3 || !v.components.every((n) => n === 'none' || (typeof n === 'number' && Number.isFinite(n)))) throw new Error('Color tokens need three finite components.')
  const [mode, channels] = definition
  const input = { mode, ...Object.fromEntries(channels.map((channel, i) => {
    const component = v.components as (number | 'none')[]
    let n = component[i] === 'none' ? 0 : component[i]
    if ((mode === 'hsl' || mode === 'hwb') && i > 0) n /= 100
    return [channel, n]
  })) } as Color
  const lab = toLab(input)
  if (![lab.l, lab.a, lab.b].every(Number.isFinite)) throw new Error('Invalid color token components.')
  // Store RGB token precision perceptually instead of rounding to 8-bit hex.
  return formatCss(mode === 'oklab' || mode === 'oklch' || mode === 'hsl' ? input : lab)
}

function parseTokenFile(root: object): string[] {
  const entries = new Map<string, { value: unknown; type: unknown }>()
  const walk = (node: unknown, path: string[], inherited: unknown, depth: number) => {
    if (depth > 40) throw new Error('Token groups are nested too deeply.')
    if (!node || typeof node !== 'object' || Array.isArray(node)) return
    const record = node as Record<string, unknown>
    const type = record.$type ?? inherited
    if ('$value' in record) { entries.set(path.join('.'), { value: record.$value, type }); return }
    for (const [name, child] of Object.entries(record)) if (!name.startsWith('$')) walk(child, [...path, name], type, depth + 1)
  }
  walk(root, [], undefined, 0)
  const resolve = (path: string, seen = new Set<string>()): string => {
    if (seen.has(path)) throw new Error('Circular color token reference.')
    const token = entries.get(path)
    if (!token || token.type !== 'color') throw new Error(`Missing color token: ${path}`)
    if (typeof token.value === 'string' && /^\{[^{}]+\}$/.test(token.value)) {
      seen.add(path)
      return resolve(token.value.slice(1, -1), seen)
    }
    return fromDtcg(token.value)
  }
  return [...entries].filter(([, token]) => token.type === 'color').map(([path]) => resolve(path))
}

export function parsePalette(text: string): string[] {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { /* raw text or CSS */ }
  if (Array.isArray(parsed)) return parsed.filter((c): c is string => typeof c === 'string').map(tokenToColor).filter((c): c is string => c !== null)
  if (parsed && typeof parsed === 'object') return parseTokenFile(parsed)
  // Parse declarations individually so named colors and functions can mix.
  const declarations = [...text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(?:^|[;{])\s*--[\w-]+\s*:\s*([^;{}]+)(?=;|}|$)/g)]
  if (declarations.length) return declarations.map((m) => tokenToColor(m[1].trim())).filter((c): c is string => c !== null)
  const lines = text.split(/\r?\n/).map((line) => line.trim().replace(/[,;]$/, '')).filter(Boolean)
  const lineColors = lines.map(tokenToColor)
  if (lineColors.length > 0 && lineColors.every((value) => value !== null)) return lineColors
  const tokens = text.match(/#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?|hwb|lab|lch|oklch|oklab|color)\([^)]*\)/gi) ?? []
  return tokens.map(tokenToColor).filter((c): c is string => c !== null)
}

export const EXPORT_FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'raw', label: 'Raw' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
]

// `colors` arrive already formatted in the output color format (hex, rgb,
// oklch, …); this only decides the wrapper structure
export function formatPalette(colors: string[], format: ExportFormat): string {
  switch (format) {
    case 'raw':
      return colors.join('\n')
    case 'css':
      return [
        ':root {',
        ...colors.map((color, i) => `  --palette-${i + 1}: ${color};`),
        '}',
      ].join('\n')
    case 'json': {
      // DTCG design-tokens file: a color group with one token per swatch
      const group: Record<string, unknown> = { $type: 'color' }
      colors.forEach((color, i) => {
        const value = parseCssColor(color)
        if (value) group[String(i + 1)] = { $value: toDtcgValue(value) }
      })
      return JSON.stringify({ palette: group }, null, 2)
    }
  }
}

const EXTENSIONS: Record<ExportFormat, string> = {
  raw: 'txt',
  css: 'css',
  json: 'json',
}

export function downloadText(filename: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  // revoking in the same task can cancel the download before it starts in
  // some browsers; let the current task finish first
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

// Clipboard writes reject on insecure origins and denied permissions. Report
// the actual outcome so callers never show a false "Copied" confirmation, and
// retain the older synchronous path for browsers without Clipboard API access.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the selection-based fallback.
  }

  const input = document.createElement('textarea')
  input.value = text
  input.readOnly = true
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.append(input)
  input.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    input.remove()
  }
}

export function downloadPalette(colors: string[], format: ExportFormat) {
  const mime: Record<ExportFormat, string> = {
    raw: 'text/plain',
    css: 'text/css',
    json: 'application/json',
  }
  downloadText(`palette.${EXTENSIONS[format]}`, formatPalette(colors, format), mime[format])
}

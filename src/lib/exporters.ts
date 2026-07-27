import { convertValue, parseCssColor, type ColorValue } from './color'

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

const tokenToHex = (raw: string): string | null => {
  const value = parseCssColor(raw.trim())
  if (!value) return null
  const hex = convertValue(value, 'hex')
  return hex.space === 'hex' ? hex.hex : null
}

// Inverse of formatPalette, tolerant of hand-made files: tries JSON first,
// then scans the text for color tokens (hex or css color functions)
export function parsePalette(text: string): string[] {
  try {
    const parsed: unknown = JSON.parse(text)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((entry): entry is string => typeof entry === 'string')
        .map(tokenToHex)
        .filter((hex): hex is string => hex !== null)
    }
  } catch {
    // not JSON — fall through to token scanning
  }
  const tokens =
    text.match(
      /#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?|hwb|lab|lch|oklch|oklab|color)\([^)]*\)/g
    ) ?? []
  const scanned = tokens.map(tokenToHex).filter((hex): hex is string => hex !== null)
  if (scanned.length > 0) return scanned

  const directValues = [
    ...text.split(/\r?\n/).map((line) => line.trim().replace(/[,;]$/, '')),
    ...[...text.matchAll(/:\s*([^;{}\n]+)\s*;?/g)].map((match) => match[1].trim()),
  ]
  return directValues.map(tokenToHex).filter((hex): hex is string => hex !== null)
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

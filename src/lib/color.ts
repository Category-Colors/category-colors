import { clampRgb, converter, formatCss, formatHex, parse } from 'culori'
import type { Color } from 'culori'

// Colors are stored in the space the user chose; conversion only happens when
// they switch spaces or the algorithm needs a culori-shaped input.
export type Space = 'hex' | 'rgb' | 'hsl' | 'oklch' | 'oklab'

export type ColorValue =
  | { space: 'hex'; hex: string }
  | { space: 'rgb'; r: number; g: number; b: number } // 0–255
  | { space: 'hsl'; h: number; s: number; l: number } // h 0–360, s/l 0–100 (%)
  | { space: 'oklch'; l: number; c: number; h: number }
  | { space: 'oklab'; l: number; a: number; b: number }

export type Hsv = [number, number, number] // h 0–360, s 0–1, v 0–1

const toRgbMode = converter('rgb')
const toHsvMode = converter('hsv')
const toHslMode = converter('hsl')
const toOklchMode = converter('oklch')
const toOklabMode = converter('oklab')

const round = (v: number, decimals: number) => {
  const p = 10 ** decimals
  return Math.round(v * p) / p
}

export const hexValue = (hex: string): ColorValue => ({ space: 'hex', hex })

// Culori-shaped color: what the categorycolors algorithm (also culori-based)
// and culori's own converters consume.
export function toCulori(value: ColorValue): Color | string {
  switch (value.space) {
    case 'hex':
      return value.hex
    case 'rgb':
      return { mode: 'rgb', r: value.r / 255, g: value.g / 255, b: value.b / 255 }
    case 'hsl':
      return { mode: 'hsl', h: value.h, s: value.s / 100, l: value.l / 100 }
    case 'oklch':
      return { mode: 'oklch', l: value.l, c: value.c, h: value.h }
    case 'oklab':
      return { mode: 'oklab', l: value.l, a: value.a, b: value.b }
  }
}

// Our color inputs are validated before they get here, so parse can't miss;
// the fallback only satisfies the types.
const resolve = (color: Color | string): Color =>
  typeof color === 'string' ? (parse(color) ?? { mode: 'rgb', r: 0, g: 0, b: 0 }) : color

function fromCulori(space: Space, input: Color | string): ColorValue {
  const color = resolve(input)
  switch (space) {
    case 'hex':
      return { space, hex: formatHex(clampRgb(toRgbMode(color))).toUpperCase() }
    case 'rgb': {
      const { r, g, b } = clampRgb(toRgbMode(color))
      return { space, r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
    }
    case 'hsl': {
      const { h, s, l } = toHslMode(clampRgb(toRgbMode(color)))
      return { space, h: round(h ?? 0, 1), s: round(s * 100, 1), l: round(l * 100, 1) }
    }
    case 'oklch': {
      const { l, c, h } = toOklchMode(color)
      return { space, l: round(l, 3), c: round(c, 3), h: round(h ?? 0, 1) }
    }
    case 'oklab': {
      const { l, a, b } = toOklabMode(color)
      return { space, l: round(l, 3), a: round(a, 3), b: round(b, 3) }
    }
  }
}

export function convertValue(value: ColorValue, space: Space): ColorValue {
  return value.space === space ? value : fromCulori(space, toCulori(value))
}

export function valueToCss(value: ColorValue): string {
  switch (value.space) {
    case 'hex':
      return value.hex
    case 'rgb':
      return `rgb(${value.r}, ${value.g}, ${value.b})`
    case 'hsl':
      return `hsl(${value.h} ${value.s}% ${value.l}%)`
    default:
      return formatCss(resolve(toCulori(value)))
  }
}

// Any valid CSS color; the notation picks the stored space (hsl()/oklch()/
// oklab() keep theirs, #hex stays hex, everything else — including named
// colors — lands in rgb).
export function parseCssColor(text: string): ColorValue | null {
  const t = text.trim()
  const parsed = parse(t)
  if (!parsed) return null
  if (t.startsWith('#')) return fromCulori('hex', parsed)
  const space =
    parsed.mode === 'hsl' || parsed.mode === 'oklch' || parsed.mode === 'oklab'
      ? parsed.mode
      : 'rgb'
  return fromCulori(space, parsed)
}

export function valueToHsv(value: ColorValue): Hsv {
  const { h, s, v } = toHsvMode(clampRgb(toRgbMode(resolve(toCulori(value)))))
  return [h ?? 0, s, v]
}

export function hsvToValue(space: Space, hsv: Hsv): ColorValue {
  return fromCulori(space, { mode: 'hsv', h: hsv[0], s: hsv[1], v: hsv[2] })
}

export const hsvToHex = (hsv: Hsv) =>
  formatHex({ mode: 'hsv', h: hsv[0], s: hsv[1], v: hsv[2] }).toUpperCase()

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

const finiteChannel = (
  value: unknown,
  min: number,
  max: number,
  decimals?: number
): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const clamped = Math.max(min, Math.min(max, value))
  return decimals === undefined ? clamped : round(clamped, decimals)
}

// ColorValue objects cross two untrusted boundaries: configuration imports and
// structured-clone messages to the worker. Validate the discriminant and every
// channel in one place so malformed objects cannot turn into NaN inside culori
// or the optimizer.
export function normalizeColorValue(input: unknown): ColorValue | null {
  if (!input || typeof input !== 'object') return null
  const value = input as Record<string, unknown>

  switch (value.space) {
    case 'hex': {
      if (typeof value.hex !== 'string' || !/^#[0-9a-f]{3,8}$/i.test(value.hex)) return null
      const parsed = parseCssColor(value.hex)
      return parsed ? convertValue(parsed, 'hex') : null
    }
    case 'rgb': {
      const r = finiteChannel(value.r, 0, 255, 0)
      const g = finiteChannel(value.g, 0, 255, 0)
      const b = finiteChannel(value.b, 0, 255, 0)
      return r === null || g === null || b === null ? null : { space: 'rgb', r, g, b }
    }
    case 'hsl': {
      const h = finiteChannel(value.h, 0, 360, 1)
      const s = finiteChannel(value.s, 0, 100, 1)
      const l = finiteChannel(value.l, 0, 100, 1)
      return h === null || s === null || l === null ? null : { space: 'hsl', h, s, l }
    }
    case 'oklch': {
      const l = finiteChannel(value.l, 0, 1, 3)
      const c = finiteChannel(value.c, 0, 0.5, 3)
      const h = finiteChannel(value.h, 0, 360, 1)
      return l === null || c === null || h === null ? null : { space: 'oklch', l, c, h }
    }
    case 'oklab': {
      const l = finiteChannel(value.l, 0, 1, 3)
      const a = finiteChannel(value.a, -0.4, 0.4, 3)
      const b = finiteChannel(value.b, -0.4, 0.4, 3)
      return l === null || a === null || b === null ? null : { space: 'oklab', l, a, b }
    }
    default:
      return null
  }
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

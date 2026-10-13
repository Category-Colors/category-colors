import { convertValue, parseCssColor, valueToCss } from './color'
import { PARAM_PRESETS, newInitColor, parseParams, presetParams, type PaletteParams, type PaletteVersion } from './palette'
import { PRESET_PALETTES } from './presets'
import { buildJndReport, testTitles } from './report'
import { linkFor } from './share'

// What the browser's WebMCP tools (webmcp.ts) and the remote MCP server
// (functions/mcp.ts) share: input schemas, validation, and how a palette is
// described back to an agent. Neither depends on page state.

export const MAX_COLORS = 20
const MAX_PAIRS_PER_TEST = 10
export const STYLES = PARAM_PRESETS.map((p) => p.label.toLowerCase())
export const PRESET_NAMES = PRESET_PALETTES.map((p) => p.name)

export const colorList = (description: string, minItems: number) => ({
  type: 'array',
  description,
  items: { type: 'string', description: 'Any CSS color: hex, rgb(), hsl(), oklch(), oklab() or a named color.' },
  minItems,
  maxItems: MAX_COLORS,
})

// Parses agent-supplied colors with the app's own parser, and names every
// value it can't read so the agent can fix them in one go.
export function readColors(value: unknown, minItems: number): string[] {
  if (!Array.isArray(value)) throw new Error('colors must be an array of CSS color strings.')
  if (value.length < minItems || value.length > MAX_COLORS) {
    throw new Error(`Give between ${minItems} and ${MAX_COLORS} colors; got ${value.length}.`)
  }
  const bad = value.filter((c) => typeof c !== 'string' || !parseCssColor(c))
  if (bad.length) throw new Error(`Not valid CSS colors: ${bad.map((c) => JSON.stringify(c)).join(', ')}.`)
  return value.map((c: string) => c.trim())
}

export function swatch(css: string) {
  const value = parseCssColor(css)
  if (!value) return { css }
  return { css, hex: valueToCss(convertValue(value, 'hex')), oklch: valueToCss(convertValue(value, 'oklch')) }
}

const round = (n: number) => Math.round(n * 10) / 10

// The report tab's checks: every pair of colors under normal vision and each
// simulated color vision deficiency, flagged when ΔE falls below the JND.
export function report(version: PaletteVersion) {
  const result = buildJndReport(version)
  if (!result) return null
  const titles = testTitles(result.tests)
  return {
    jndThreshold: version.params.jnd,
    totalIssues: result.totalIssues,
    tests: result.tests.map((test, i) => ({
      vision: titles[i],
      issueCount: test.issueCount,
      closePairs: test.issues
        .slice()
        .sort((a, b) => a.deltaE - b.deltaE)
        .slice(0, MAX_PAIRS_PER_TEST)
        .map((pair) => ({ colors: pair.colors, positions: [pair.indexA + 1, pair.indexB + 1], deltaE: round(pair.deltaE) })),
    })),
  }
}

// A palette as an agent sees it: each color in three notations, the report,
// and a link that opens it, with the settings that made it, in the app
export async function summarize(version: PaletteVersion) {
  return {
    colors: version.colors.map(swatch),
    report: report(version),
    link: (globalThis.location?.origin ?? 'https://categorycolors.com') + (await linkFor(version.colors, version.params)),
  }
}

// The same for a palette in the page's history
export async function describe(version: PaletteVersion) {
  return {
    versionId: version.id,
    source: version.costHistory.length ? 'generated' : 'imported',
    edited: Boolean(version.edited),
    ...(await summarize(version)),
  }
}

// A throwaway version, so check_palette and export_palette can work on colors
// that aren't in history yet, under the panel's current criteria.
export const scratch = (colors: string[], params: PaletteParams): PaletteVersion => ({
  id: -1,
  params,
  colors,
  cost: 0,
  iterations: 0,
  costHistory: [],
  createdAt: Date.now(),
})

export const GENERATE_INPUT = {
  colorCount: { type: 'integer', minimum: 2, maximum: MAX_COLORS, description: 'How many colors to generate.' },
  style: {
    type: 'string',
    enum: STYLES,
    description: 'Starting recipe: vivid (saturated, mid lightness), dusky (muted, dark) or pastel (soft, light). Replaces the base settings for this run.',
  },
  fixedColors: colorList('Colors that must appear unchanged in the result, such as brand colors. The optimizer chooses the rest around them.', 1),
  jnd: {
    type: 'number',
    minimum: 5,
    maximum: 40,
    description: 'Minimum CIEDE2000 distance two colors should keep to read as different. Higher asks for more separation; the default is 20.',
  },
}

// generate_palette's input over `base` settings, through parseParams, the
// import path's validator, so every number lands in the range the panel allows
export function generateParams(input: Record<string, unknown>, base: PaletteParams): PaletteParams {
  const style = PARAM_PRESETS.find((p) => p.label.toLowerCase() === input.style)
  if (input.style !== undefined && !style) throw new Error(`style must be one of ${STYLES.join(', ')}.`)
  const start = structuredClone(style ? presetParams(style) : base)
  const fixed = input.fixedColors === undefined ? null : readColors(input.fixedColors, 1)
  const requested = typeof input.colorCount === 'number' ? input.colorCount : start.colorCount
  const draft: PaletteParams = {
    ...start,
    colorCount: Math.max(requested, fixed?.length ?? 0),
    jnd: typeof input.jnd === 'number' ? input.jnd : start.jnd,
    initColors: fixed ? fixed.map((css) => ({ ...newInitColor(parseCssColor(css)!), fixedColor: true })) : start.initColors,
  }
  const params = parseParams(JSON.stringify(draft))
  if (!params) throw new Error('Those settings could not be turned into a valid configuration.')
  return params
}

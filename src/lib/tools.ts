import { convertValue, parseCssColor, valueToCss } from './color'
import { WORKING_SPACES, spaceChannels } from './color-spaces'
import { CVD_TYPES, EVALUATOR_TYPES, TYPE_HINTS } from './evaluators'
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
// simulated color vision deficiency, flagged when ΔE falls below the JND. Each
// test also carries its closest pair's distance, and the report the smallest
// of those, so an agent comparing candidates has a score and not just a
// pass/fail list.
export function report(version: PaletteVersion) {
  const result = buildJndReport(version)
  if (!result) return null
  const titles = testTitles(result.tests)
  const tests = result.tests.map((test, i) => ({
    vision: titles[i],
    minDeltaE: round(Math.min(...(test.pairs ?? test.issues).map((p) => p.deltaE))),
    issueCount: test.issueCount,
    closePairs: test.issues
      .slice()
      .sort((a, b) => a.deltaE - b.deltaE)
      .slice(0, MAX_PAIRS_PER_TEST)
      .map((pair) => ({ colors: pair.colors, positions: [pair.indexA + 1, pair.indexB + 1], deltaE: round(pair.deltaE) })),
  }))
  return {
    jndThreshold: version.params.jnd,
    minDeltaE: Math.min(...tests.map((t) => t.minDeltaE)),
    totalIssues: result.totalIssues,
    tests,
  }
}

// A palette as an agent sees it: each color in three notations, the report,
// the settings it was made or checked under (the same shape the Configure
// panel imports and generate_palette's `config` takes), and a link that opens
// it in the app. Generated palettes carry the optimizer's final cost too.
export async function summarize(version: PaletteVersion) {
  return {
    colors: version.colors.map(swatch),
    report: report(version),
    config: version.params,
    ...(version.iterations ? { cost: version.cost } : {}),
    ...(version.seed !== undefined ? { seed: version.seed } : {}),
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

const GENERATE_INPUT_COUNT = { type: 'integer', minimum: 2, maximum: MAX_COLORS, description: 'How many colors to generate.' }

const colorValue = {
  type: 'object',
  description: 'A color as {space:"hex",hex} or {space:"oklch",l,c,h}; rgb, hsl and oklab forms take their channels by name.',
  properties: { space: { type: 'string', enum: ['hex', 'rgb', 'hsl', 'oklch', 'oklab'] } },
  required: ['space'],
}

// Everything the Configure panel can set, as JSON Schema: the file the panel
// imports and exports, and what summarize() echoes back as `config`. Every
// field is optional; parseParams fills and clamps the rest.
export const CONFIG_SCHEMA = {
  type: 'object',
  description: 'The full optimizer configuration, the same JSON the app\'s Configure panel imports and exports. Any field may be omitted.',
  properties: {
    colorCount: GENERATE_INPUT_COUNT,
    jnd: { type: 'number', minimum: 5, maximum: 40, description: 'CIEDE2000 distance below which two colors count as confusable.' },
    maxIterations: { type: 'integer', minimum: 1000, maximum: 100000, description: 'Annealing steps. 60000 converges; fewer is faster but worse.' },
    orderOptimization: { type: 'boolean', description: 'Reorder the result so adjacent colors differ most.' },
    colorSpace: {
      type: 'object',
      description: 'The space the optimizer moves in, with a [min, max] range per channel in that space\'s channel order: ' +
        WORKING_SPACES.map((s) => `${s.mode} (${spaceChannels(s.mode).map((c) => c.key).join(', ')})`).join('; ') + '.',
      properties: {
        mode: { type: 'string', enum: WORKING_SPACES.map((s) => s.mode) },
        ranges: { type: 'array', items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 } },
      },
      required: ['mode', 'ranges'],
    },
    initColors: {
      type: 'array',
      maxItems: MAX_COLORS,
      description: 'Starting colors. fixedColor keeps the value unchanged; fixedOrder keeps its position.',
      items: { type: 'object', properties: { value: colorValue, fixedColor: { type: 'boolean' }, fixedOrder: { type: 'boolean' } }, required: ['value'] },
    },
    targets: {
      type: 'array',
      description: 'Colors the similarity evaluator pulls the palette toward.',
      items: { type: 'object', properties: { value: colorValue }, required: ['value'] },
    },
    evaluators: {
      type: 'array',
      description: 'The weighted objective. Types: ' + EVALUATOR_TYPES.map((t) => `${t} (${TYPE_HINTS[t]})`).join('; ') + '. Only the fields a type reads matter.',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: EVALUATOR_TYPES },
          weight: { type: 'number', minimum: 0, maximum: 1 },
          cvd: { type: 'string', enum: CVD_TYPES, description: 'cvd only.' },
          cvdSeverity: { type: 'number', minimum: 0, maximum: 1, description: 'cvd only; 1 is the full deficiency.' },
          background: { type: 'string', description: 'contrast only: hex background to hold WCAG contrast against.' },
          ratio: { type: 'number', minimum: 1, maximum: 7, description: 'contrast only: WCAG ratio to hold.' },
          checkAdjacent: { type: 'boolean', description: 'contrast only: hold the ratio between neighbors instead.' },
          avoidColors: { type: 'array', description: 'avoid only.', items: { type: 'object', properties: { value: colorValue }, required: ['value'] } },
          avoidRadius: { type: 'number', minimum: 0.05, maximum: 0.5, description: 'avoid only: how far to stay from each avoided color.' },
        },
        required: ['type'],
      },
    },
  },
}

export const GENERATE_INPUT = {
  config: CONFIG_SCHEMA,
  colorCount: GENERATE_INPUT_COUNT,
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
  seed: {
    type: 'integer',
    minimum: 0,
    maximum: 2 ** 31 - 1,
    description: 'Runs are random. The same config and seed reproduce a palette exactly; every result reports the seed it used. Omit for a fresh draw.',
  },
}

// generate_palette's seed, or undefined for a fresh one
export function readSeed(value: unknown): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error('seed must be a non-negative integer.')
  return value as number
}

// generate_palette's input over `base` settings, through parseParams, the
// import path's validator, so every number lands in the range the panel allows.
// Precedence, lowest first: base, style, config, then the named shortcuts.
export function generateParams(input: Record<string, unknown>, base: PaletteParams): PaletteParams {
  const style = PARAM_PRESETS.find((p) => p.label.toLowerCase() === input.style)
  if (input.style !== undefined && !style) throw new Error(`style must be one of ${STYLES.join(', ')}.`)
  const config = input.config
  if (config !== undefined && (!config || typeof config !== 'object' || Array.isArray(config))) {
    throw new Error('config must be an object with the same shape as the Configure panel\'s exported JSON.')
  }
  const start = structuredClone({ ...(style ? presetParams(style) : base), ...(config as Partial<PaletteParams> | undefined) })
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

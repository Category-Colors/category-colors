import { wcagContrast } from 'culori'
import { formatColor } from 'category-colors'
import { convertValue, outsideSrgb, parseCssColor, valueToCss } from './color'
import { GAMUT_OPTIONS } from './color-spaces'
import { WORKING_SPACES, spaceChannels } from './color-spaces'
import { CVD_TYPES, EVALUATOR_TYPES, TYPE_HINTS } from './evaluators'
import { BEHAVIOR_NAMES, MAX_WINDOWS, PARAM_PRESETS, newEvaluatorSpec, newInitColor, parseParams, presetParams, type PaletteParams, type PaletteVersion } from './palette'
import { PRESET_PALETTES } from './presets'
import { buildJndReport, refineParams, testTitles } from './report'
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

// Under a wide gamut, a color outside sRGB also comes as color(display-p3 …)
// or color(rec2020 …), and is flagged: its hex is the nearest sRGB color.
export function swatch(css: string, gamut?: PaletteParams['colorSpace']['gamut']) {
  const value = parseCssColor(css)
  if (!value) return { css }
  const wide = gamut && outsideSrgb(css) ? { outsideSrgb: true, gamutCss: formatColor(css, gamut) } : {}
  return { css, hex: valueToCss(convertValue(value, 'hex')), oklch: valueToCss(convertValue(value, 'oklch')), ...wide }
}

// The report's caveat when colors leave sRGB, which the CVD simulations and
// WCAG contrast are defined in. Shared with the report tab.
export const OUTSIDE_SRGB_NOTE =
  'Colors outside sRGB: the CVD simulations and WCAG contrast are defined for sRGB, so their numbers for those colors are extrapolations.'

const round = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

// One entry per contrast evaluator: the WCAG ratio of every color against its
// background (or of each neighbor pair, under checkAdjacent) and the ones
// under the target. The evaluator is a penalty the optimizer weighs against
// the rest, not a floor, so a generated palette can miss it; this is where an
// agent finds out.
function contrastReport(version: PaletteVersion) {
  const specs = version.params.evaluators.filter((e) => e.type === 'contrast' && e.weight > 0)
  const { colors } = version
  return specs.map((spec) => {
    const pairs = spec.checkAdjacent
      ? colors.slice(1).map((css, i) => ({ positions: [i + 1, i + 2], ratio: round2(wcagContrast(colors[i], css)) }))
      : colors.map((css, i) => ({ positions: [i + 1], ratio: round2(wcagContrast(css, spec.background)) }))
    return {
      ...(spec.checkAdjacent ? { checkAdjacent: true } : { background: spec.background }),
      targetRatio: spec.ratio,
      minRatio: Math.min(...pairs.map((p) => p.ratio)),
      pass: pairs.every((p) => p.ratio >= spec.ratio),
      ratios: pairs.map((p) => p.ratio),
      failing: pairs.filter((p) => p.ratio < spec.ratio),
    }
  })
}

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
  const contrast = contrastReport(version)
  return {
    jndThreshold: version.params.jnd,
    minDeltaE: Math.min(...tests.map((t) => t.minDeltaE)),
    totalIssues: result.totalIssues,
    tests,
    ...(contrast.length ? { contrast } : {}),
    ...(version.colors.some(outsideSrgb) ? { note: OUTSIDE_SRGB_NOTE } : {}),
  }
}

// A palette as an agent sees it: each color in three notations, the report,
// the settings it was made or checked under (the same shape the Configure
// panel imports and generate_palette's `config` takes), and a link that opens
// it in the app. Generated palettes carry the optimizer's final cost too.
export async function summarize(version: PaletteVersion) {
  return {
    colors: version.colors.map((css) => swatch(css, version.params.colorSpace.gamut)),
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

const WINDOW_SCHEMA = { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2, description: '[min, max]' }

// Everything the Configure panel can set, as JSON Schema: the file the panel
// imports and exports, and what summarize() echoes back as `config`. Every
// field is optional; parseParams fills and clamps the rest.
export const CONFIG_SCHEMA = {
  type: 'object',
  description: 'The full optimizer configuration, the same JSON the app\'s Configure panel imports and exports. Any field may be omitted.',
  properties: {
    colorCount: GENERATE_INPUT_COUNT,
    jnd: { type: 'number', minimum: 5, maximum: 40, description: 'CIEDE2000 distance below which two colors count as confusable.' },
    maxIterations: { type: 'integer', minimum: 1000, maximum: 100000, description: 'A cap on annealing steps. A run ends on its own when it has cooled, after about 11-13k steps, so only a cap below that shortens it (and worsens it).' },
    orderOptimization: { type: 'boolean', description: 'Reorder the result so adjacent colors differ most.' },
    fixStrength: { type: 'number', minimum: 0, maximum: 1, description: 'behavior fix only, default 0.35: 1 clears the most failing pairs, 0 keeps colors closest to their seeds.' },
    behavior: { type: 'string', enum: BEHAVIOR_NAMES, description: 'optimize (default) makes the best palette the evaluators describe. evaluate runs nothing: the seeds (initColors) become the palette as they are, to read their report. fix repairs the seeds (initColors) instead: only pairs failing the JND and CVD evaluators count, energy and range pause (unless fixEnabled), and colors stay near their seeds. Pin positions with fixedOrder, and fix the seeds that already pass with fixedColor.' },
    colorSpace: {
      type: 'object',
      description: 'The space the optimizer moves in, with hard bounds per channel in that space\'s channel order: ' +
        WORKING_SPACES.map((s) => `${s.mode} (${spaceChannels(s.mode).map((c) => c.key).join(', ')})`).join('; ') +
        '. Each channel takes one [min, max] window or a list of them, such as [[0, 60], [180, 240]] to allow two hue bands; on hue, [300, 60] is the arc through zero.',
      properties: {
        mode: { type: 'string', enum: WORKING_SPACES.map((s) => s.mode) },
        gamut: {
          type: 'string',
          enum: GAMUT_OPTIONS.map((g) => g.value),
          description: 'The colors the palette may use; default srgb. display-p3 and rec2020 need mode oklch or oklab, and widen the room the optimizer has, slightly (at 12 colors, min ΔE about 23.5 in sRGB, 24.0 in P3, 24.7 in Rec. 2020). Colors outside sRGB come back flagged outsideSrgb, with gamutCss beside css; their hex is clipped.',
        },
        ranges: {
          type: 'array',
          items: { anyOf: [WINDOW_SCHEMA, { type: 'array', items: WINDOW_SCHEMA, minItems: 1, maxItems: MAX_WINDOWS }] },
        },
      },
      required: ['mode', 'ranges'],
    },
    initColors: {
      type: 'array',
      maxItems: MAX_COLORS,
      description: 'Starting colors, in slot order. Without fixedColor or lockedChannels a seed is only where the search starts, and can end anywhere.',
      items: {
        type: 'object',
        properties: {
          value: colorValue,
          fixedColor: { type: 'boolean', description: 'Keep this exact color in the palette.' },
          fixedOrder: { type: 'boolean', description: 'Keep whatever color ends up in this slot at this position when orderOptimization reorders the result. It does not hold the color: pair it with fixedColor or lockedChannels for that.' },
          lockedChannels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Channels of colorSpace.mode held at this seed\'s value while the others move, by channel name: ["h"] keeps the hue (in okhsl, hsl or oklch) and lets lightness and saturation or chroma change. Names the mode lacks are ignored.',
          },
        },
        required: ['value'],
      },
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
          ratio: { type: 'number', minimum: 1, maximum: 7, description: 'contrast only: WCAG ratio to aim for. A penalty weighed against the other terms, not a hard floor; report.contrast says which colors missed it. To guarantee it, cap lightness in colorSpace instead: in okhsl, l at most 0.58 holds 3:1 on white for every color, and usually scores better than this term.' },
          checkAdjacent: { type: 'boolean', description: 'contrast only: hold the ratio between neighbors instead.' },
          avoidColors: { type: 'array', description: 'avoid only.', items: { type: 'object', properties: { value: colorValue }, required: ['value'] } },
          avoidRadius: { type: 'number', minimum: 0.05, maximum: 0.5, description: 'avoid only: how far to stay from each avoided color.' },
          fixEnabled: { type: 'boolean', description: 'energy and range only: keep running under behavior fix, where they otherwise pause.' },
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

// fix_palette's description, shared by both servers, which each add a sentence
export const FIX_DESCRIPTION =
  'Repairs the pairs of colors that fall below the JND threshold (under normal vision and simulated color vision deficiencies) with small changes, rather than making a new palette: each color keeps its position, the fewest colors that touch every failing pair move, and the rest stay exactly as they are. Never returns more issues than it started with, and reports `issuesBefore`; call again on the result to keep going.'

// fix_palette's input beside the colors
export const FIX_INPUT = {
  strength: {
    type: 'number',
    minimum: 0,
    maximum: 1,
    description: 'How far the fix may move colors, default 0.35. 1 clears the most failing pairs; 0 keeps colors closest to where they were and leaves more pairs failing.',
  },
  jnd: {
    type: 'number',
    minimum: 5,
    maximum: 40,
    description: 'The CIEDE2000 distance a pair must reach to pass; the default is 20.',
  },
  pinned: {
    type: 'array',
    items: { type: 'integer', minimum: 1, maximum: MAX_COLORS },
    maxItems: MAX_COLORS,
    description: '1-based positions of colors that must not change, such as a brand or legacy color. The fix moves the others around them; a failing pair between two pinned colors stays as it is.',
  },
}

// check_palette's contrast inputs
export const CONTRAST_INPUT = {
  background: { type: 'string', description: 'A CSS color the palette will sit on. Adds report.contrast: each color\'s WCAG contrast ratio against it, and which fall below `ratio`.' },
  ratio: { type: 'number', minimum: 1, maximum: 21, description: 'The WCAG contrast ratio each color should reach against `background`; the default is 3, the minimum for graphical objects.' },
}

// The panel's params with a contrast row for check_palette's background, so
// the report and the link both carry it
export function withContrast(params: PaletteParams, input: Record<string, unknown>): PaletteParams {
  if (input.background === undefined) {
    if (input.ratio !== undefined) throw new Error('ratio needs a background to measure against.')
    return params
  }
  const background = typeof input.background === 'string' ? parseCssColor(input.background) : null
  if (!background) throw new Error(`background is not a valid CSS color: ${JSON.stringify(input.background)}.`)
  const ratio = input.ratio ?? 3
  if (typeof ratio !== 'number' || !(ratio >= 1 && ratio <= 21)) throw new Error('ratio must be a number from 1 to 21.')
  const hex = valueToCss(convertValue(background, 'hex'))
  return { ...params, evaluators: [...params.evaluators, newEvaluatorSpec('contrast', { background: hex, ratio })] }
}

// The app's Refine: the colors as seeds held at their positions, the fewest
// that touch every failing pair free to move and the rest fixed, under
// behavior fix. A fix never returns more issues than it was given.
export function fixParams(input: Record<string, unknown>, colors: string[], base: PaletteParams): PaletteParams {
  const strength = input.strength
  if (strength !== undefined && (typeof strength !== 'number' || !(strength >= 0 && strength <= 1))) {
    throw new Error('strength must be a number from 0 to 1.')
  }
  const pinned = input.pinned ?? []
  if (!Array.isArray(pinned) || pinned.some((p) => !Number.isInteger(p) || p < 1 || p > colors.length)) {
    throw new Error(`pinned must be a list of positions from 1 to ${colors.length}.`)
  }
  const params = refineParams({ params: generateParams({ jnd: input.jnd }, base), colors }, pinned.map((p: number) => p - 1))
  return strength === undefined ? params : { ...params, fixStrength: strength }
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
  // The importer drops a gamut it can't use; an agent asked for it, so say why
  const gamut: unknown = draft.colorSpace?.gamut
  if (gamut !== undefined && gamut !== 'srgb' && params.colorSpace.gamut !== gamut) {
    throw new Error(
      GAMUT_OPTIONS.some((g) => g.value === gamut)
        ? `colorSpace.gamut ${gamut} needs colorSpace.mode oklch or oklab; ${params.colorSpace.mode} only covers sRGB.`
        : `colorSpace.gamut must be one of ${GAMUT_OPTIONS.map((g) => g.value).join(', ')}.`
    )
  }
  return params
}

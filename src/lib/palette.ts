import { converter, parse } from 'culori'
import { hexValue, normalizeColorValue, type ColorValue } from '@/lib/color'
import { isWorkingSpace, spaceChannels, spaceInitialRanges, type WorkingSpace } from './color-spaces'
import { CVD_TYPES, EVALUATOR_TYPES } from './evaluators'

export type { WorkingSpace }

// Parameter shapes, defaults, and (de)serialization only — no algorithm.
// Driving category-colors lives in algorithm.ts so the app shell can import
// these types without pulling the optimizer into the initial bundle.

export type EvaluatorType =
  | 'energy'
  | 'range'
  | 'jnd'
  | 'cvd'
  | 'similarity'
  | 'avoid'
  | 'contrast'
  | 'saliency'
  | 'names'

// 'grayscale' is the odd one out: culori's luminance projection, the same
// matrix CSS `filter: grayscale()` uses, standing in for print or a
// photocopier. The other three are Machado et al. (2009) simulations of an
// actual vision deficiency. Keep them apart in any copy — grayscale is not a
// model of achromatopsia.
export type CvdType = 'protanomaly' | 'deuteranomaly' | 'tritanomaly' | 'grayscale'

// Grayscale has no severity to set: it stands in for print, and a
// half-desaturated palette is not something anything prints. The editor hides
// the control and both library boundaries read severity through here, so the
// value stored on the spec — the user's setting for the real deficiencies —
// survives a round trip through grayscale and back.
export const cvdSeverityFor = (spec: Pick<EvaluatorSpec, 'cvd' | 'cvdSeverity'>) =>
  spec.cvd === 'grayscale' ? 1 : spec.cvdSeverity

// Flat spec: every field always present so control wiring stays simple;
// only the fields relevant to the chosen type reach the algorithm config.
export interface EvaluatorSpec {
  id: number
  type: EvaluatorType
  weight: number
  cvd: CvdType
  cvdSeverity: number
  background: string
  ratio: number
  checkAdjacent: boolean
  avoidColors: TargetColor[]
  avoidRadius: number
  // Energy and Range only: run them under Fix issues too (they pause there by
  // default — see SPREADING_TYPES)
  fixEnabled: boolean
}

// The terms that only spread colors apart. A palette being fixed has nothing
// to spread, and on a finished one they are what made colors wander.
const SPREADING_TYPES: EvaluatorType[] = ['energy', 'range']
// Whether a row pauses when a behavior repairs, unless switched back on
export const pausesWhenRepairing = (spec: EvaluatorSpec) => SPREADING_TYPES.includes(spec.type)
export const isPausable = (spec: EvaluatorSpec, behavior: Behavior) => BEHAVIORS[behavior].repairs && pausesWhenRepairing(spec)
export const isPaused = (spec: EvaluatorSpec, behavior: Behavior) => isPausable(spec, behavior) && !spec.fixEnabled

// Windows a channel may carry; the importer keeps this many and the slider
// stops adding at it
export const MAX_WINDOWS = 20

// Seeds state.colors: fixedColor pins the value through annealing,
// fixedOrder pins the position through order optimization.
export interface InitColor {
  id: number
  value: ColorValue
  fixedColor: boolean
  fixedOrder: boolean
}

// Feeds config.similarityTarget; only the similarity evaluator reads it.
export interface TargetColor {
  id: number
  value: ColorValue
}

// A [min, max] a channel may take. Each channel has one or more, as hard
// bounds: a color is never generated or moved outside every window.
export type ChannelWindow = [number, number]

// The annealer's working space and per-channel windows. Channel order follows
// the mode (okhsl = h/s/l, oklch = l/c/h, …) — see color-spaces.ts.
export interface ColorSpaceParams {
  mode: WorkingSpace
  ranges: ChannelWindow[][]
}

export const defaultColorSpace = (mode: WorkingSpace): ColorSpaceParams => ({
  mode,
  ranges: spaceInitialRanges(mode).map((r) => [r]),
})

// Sorted, non-overlapping, non-empty windows from any list of them, as the
// package reads them: on a cyclic channel of the given period, a backwards
// window is the arc through zero ([300, 60] is [0, 60] and [300, 360]);
// otherwise backwards is just reversed. Touching or overlapping windows
// merge, and ones with no width drop unless nothing else is left.
export function tidyWindows(windows: ChannelWindow[], period?: number): ChannelWindow[] {
  const split = windows.flatMap(([a, b]): ChannelWindow[] =>
    a <= b ? [[a, b]] : period ? [[0, b], [a, period]] : [[b, a]]
  )
  const merged: ChannelWindow[] = []
  for (const w of split.sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1)
    if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1])
    else merged.push([...w])
  }
  const wide = merged.filter(([a, b]) => b > a)
  return wide.length ? wide : merged.slice(0, 1)
}

// What a run is for. Everything that differs between behaviors reads one of
// these rules, rather than checking a behavior by name:
// - runs: false runs nothing, and the seeds become the palette as they are,
//   so run length and the order pass don't apply
// - repairs: the seeds are a palette to fix, not a starting point. Scored by
//   failing pairs and distance from each seed (fix.ts), started partway down
//   the schedule by Strength, never handed back with more issues, positions
//   kept (no order pass), spreading terms paused, and its output seeds the
//   next run
export const BEHAVIORS = {
  optimize: {
    label: 'Generate & optimize',
    description: 'Builds a new palette from scratch',
    action: 'Generate',
    runs: true,
    repairs: false,
  },
  fix: {
    label: 'Fix issues',
    description: 'Repairs failing pairs with small changes',
    action: 'Fix issues',
    runs: true,
    repairs: true,
  },
  evaluate: {
    label: 'Evaluate',
    description: 'Evaluates the initialized colors',
    action: 'Evaluate',
    runs: false,
    repairs: false,
  },
} as const
export type Behavior = keyof typeof BEHAVIORS
export const BEHAVIOR_NAMES = Object.keys(BEHAVIORS) as Behavior[]

// Whether a run reorders its result: asked for, and the behavior lets
// positions change
export const ordersColors = (params: PaletteParams) => params.orderOptimization && !BEHAVIORS[params.behavior].repairs

// The same windows, each stretched just far enough to take in every one of
// these colors. The package snaps a seed outside every window to the nearest
// edge before the run starts, so a finished palette loaded under narrower
// settings would be redrawn before anything was fixed (Okabe–Ito's grey moved
// 12 ΔE that way). A value is reached from whichever window edge is nearest,
// around the circle on a cyclic channel; a grey has no hue and asks nothing of
// that channel.
export function colorSpaceContaining(space: ColorSpaceParams, colors: string[]): ColorSpaceParams {
  const toMode = converter(space.mode)
  const points = colors.map((css) => toMode(parse(css)) as Record<string, number | undefined> | undefined)
  return {
    mode: space.mode,
    ranges: spaceChannels(space.mode).map((channel, i) => {
      const windows = space.ranges[i].map((w): ChannelWindow => [...w])
      const gap = (from: number, to: number) => {
        const d = to - from
        return channel.period ? ((d % channel.period) + channel.period) % channel.period : Math.abs(d)
      }
      for (const point of points) {
        const v = point?.[channel.key]
        if (v === undefined || Number.isNaN(v)) continue
        const value = Math.min(channel.max, Math.max(channel.min, v))
        const inside = tidyWindows(windows, channel.period).some(([a, b]) => value >= a && value <= b)
        if (inside) continue
        // nearest edge: forward past a window's end, or back before its start
        let best = { gap: Infinity, index: 0, end: 1 as 0 | 1 }
        windows.forEach(([a, b], index) => {
          const after = channel.period ? gap(b, value) : value > b ? value - b : Infinity
          const before = channel.period ? gap(value, a) : value < a ? a - value : Infinity
          if (after < best.gap) best = { gap: after, index, end: 1 }
          if (before < best.gap) best = { gap: before, index, end: 0 }
        })
        windows[best.index][best.end] = value
      }
      return tidyWindows(windows, channel.period)
    }),
  }
}

export interface PaletteParams {
  colorCount: number
  jnd: number
  maxIterations: number
  orderOptimization: boolean
  // see BEHAVIORS
  behavior: Behavior
  // Fix issues only: 1 clears the most failing pairs, 0 keeps colors closest
  // to their seeds (see scheduleFor in fix.ts)
  fixStrength: number
  initColors: InitColor[]
  targets: TargetColor[]
  evaluators: EvaluatorSpec[]
  colorSpace: ColorSpaceParams
}

// Sampled point on the annealer's loss curve: [iteration, cost]
export type CostSample = [iteration: number, cost: number]

export interface PaletteVersion {
  edited?: boolean
  id: number
  params: PaletteParams
  colors: string[]
  cost: number
  iterations: number
  costHistory: CostSample[]
  // The optimizer's seed: the same params and seed make this palette again.
  // Kept on the version, not the params, so the panel never repeats a run.
  seed?: number
  createdAt: number
}

const SPEC_DEFAULTS = {
  weight: 0.25,
  cvd: 'deuteranomaly' as CvdType,
  cvdSeverity: 0.5,
  background: '#ffffff',
  ratio: 3,
  checkAdjacent: false,
  avoidRadius: 0.15,
  fixEnabled: false,
}

let nextId = 0
export function newEvaluatorSpec(
  type: EvaluatorType,
  overrides: Partial<EvaluatorSpec> = {}
): EvaluatorSpec {
  nextId += 1
  // avoidColors gets a fresh array per spec so lists are never shared
  return { id: nextId, type, ...SPEC_DEFAULTS, avoidColors: [], ...overrides }
}

export function newInitColor(value: ColorValue = hexValue('#888888')): InitColor {
  nextId += 1
  return { id: nextId, value, fixedColor: false, fixedOrder: false }
}

export function newTargetColor(value: ColorValue = hexValue('#888888')): TargetColor {
  nextId += 1
  return { id: nextId, value }
}

// The optimizer starts unopinionated: random initialization (no seeds, no
// targets, no similarity pull) with the perceptual evaluators only.
//
// These mirror category-colors 3.0's `createDefaultConfig()`. The severity of
// 1 is the point: Machado's model has no separate dichromacy matrix, so
// `protanomaly` at severity 1 *is* protanopia, and optimizing the harder case
// carries the milder one. That is why the app's narrower CvdType can express
// the library's default exactly despite naming only the anomaly variants.
//
// The CVD weights look far too low next to an unimpaired `jnd` of 1 until you
// measure them — the terms saturate early. Lower the `jnd` weight to trade
// ordinary separation back for CVD headroom.
//
// Grayscale is left out, as in the library's since 3.5.0: lightness alone spans
// about 100 ΔE, so past five or six colors no palette passes it at a JND of 20,
// and a term that can't be met only drags the rest of the run after it. It is
// one click away in the evaluator menu for palettes that really will be printed.
const DEFAULT_EVALUATORS: EvaluatorSpec[] = [
  newEvaluatorSpec('energy', { weight: 0.15 }),
  newEvaluatorSpec('range', { weight: 0.15 }),
  newEvaluatorSpec('jnd', { weight: 1 }),
  newEvaluatorSpec('cvd', { weight: 0.1, cvd: 'protanomaly', cvdSeverity: 1 }),
  newEvaluatorSpec('cvd', { weight: 0.1, cvd: 'deuteranomaly', cvdSeverity: 1 }),
  newEvaluatorSpec('cvd', { weight: 0.1, cvd: 'tritanomaly', cvdSeverity: 1 }),
]

export const DEFAULT_PARAMS: PaletteParams = {
  colorCount: 8,
  jnd: 20,
  // 20000 was enough for the older five-term objective, which converged well
  // inside it. This one does not: measured at eight colors, cutting it off at
  // 20000 costs about eight points of ordinary separation (23.2 -> 15.8 mean
  // minimum deltaE) and leaves the worst case at 4.0 instead of 7.7. The extra
  // iterations are nearly free in wall clock — cooling hits `cutoff` first, so
  // a run ends on temperature around 40-60k either way, and 60000 buys full
  // convergence for roughly 6s more on the first generate rather than 3x.
  maxIterations: 60000,
  orderOptimization: true,
  behavior: 'optimize',
  fixStrength: 0.35,
  initColors: [],
  targets: [],
  evaluators: DEFAULT_EVALUATORS,
  colorSpace: defaultColorSpace('okhsl'),
}

// Presets of the panel's own settings: a count plus OKHSL saturation and
// lightness bands, over the defaults. The panel adopts them, so each is also a
// worked example of step 1. (PRESET_PALETTES in presets.ts are finished palettes.)
export const PARAM_PRESETS: { label: string; count: number; s: [number, number]; l: [number, number] }[] = [
  { label: 'Vivid', count: 8, s: [0.75, 1], l: [0.5, 0.75] },
  { label: 'Dusky', count: 12, s: [0.2, 0.5], l: [0.25, 0.55] },
  { label: 'Pastel', count: 6, s: [0.35, 0.65], l: [0.78, 0.92] },
]

export const presetParams = (p: (typeof PARAM_PRESETS)[number]): PaletteParams => {
  const space = defaultColorSpace('okhsl')
  return {
    ...DEFAULT_PARAMS,
    colorCount: p.count,
    colorSpace: { ...space, ranges: [space.ranges[0], [p.s], [p.l]] },
  }
}


// Params sized to a finished palette, in a space that already holds every one
// of its colors, so none moves before a run starts
export const fittedTo = (params: PaletteParams, colors: string[]): PaletteParams => ({
  ...params,
  colorCount: colors.length,
  colorSpace: colorSpaceContaining(params.colorSpace, colors),
})

// Settings a finished palette (a preset) comes in with: the defaults, fitted
// to it. Not the panel's settings, which belong to whatever the person was
// making before.
export const paletteParams = (colors: string[]): PaletteParams => fittedTo(structuredClone(DEFAULT_PARAMS), colors)

const IMPORT_LIMITS = {
  textLength: 1_000_000,
  initColors: 20,
  targets: 100,
  evaluators: 50,
  avoidColors: 100,
} as const

const boundedNumber = (
  value: unknown,
  fallback: number,
  min: number,
  max: number
) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback

const normalizedHex = (value: unknown, fallback: string) => {
  const color = normalizeColorValue(
    typeof value === 'string' ? { space: 'hex', hex: value } : null
  )
  return color?.space === 'hex' ? color.hex : fallback
}

// A space is only honored when its mode is known and it carries one range per
// channel of that mode; each bound is clamped to the channel's own limits so a
// hand-edited file can't put the annealer outside the space. A channel's entry
// is a list of windows, or a single [min, max] as files before 3.3 wrote it;
// tidyWindows reads them the way the package will.
function parseColorSpace(space: Partial<ColorSpaceParams> | undefined): ColorSpaceParams {
  if (!isWorkingSpace(space?.mode)) return defaultColorSpace('okhsl')
  const channels = spaceChannels(space.mode)
  if (!Array.isArray(space.ranges) || space.ranges.length !== channels.length) {
    return defaultColorSpace(space.mode)
  }
  return {
    mode: space.mode,
    ranges: channels.map((channel, i) => {
      const raw: unknown = space.ranges![i]
      const clamp = (v: unknown, fallback: number) =>
        typeof v === 'number' && Number.isFinite(v)
          ? Math.min(channel.max, Math.max(channel.min, v))
          : fallback
      const pairs: unknown[] = !Array.isArray(raw) ? [] : typeof raw[0] === 'number' ? [raw] : raw
      const windows = pairs.slice(0, MAX_WINDOWS).flatMap((pair): ChannelWindow[] =>
        Array.isArray(pair) ? [[clamp(pair[0], channel.initial[0]), clamp(pair[1], channel.initial[1])]] : []
      )
      return windows.length ? tidyWindows(windows, channel.period) : [[...channel.initial]]
    }),
  }
}

// Parse an exported configuration file. Entries get fresh ids so imports
// can't collide with rows created afterwards; malformed entries are dropped.
export function parseParams(text: string): PaletteParams | null {
  if (text.length > IMPORT_LIMITS.textLength) return null
  try {
    const raw = JSON.parse(text) as Partial<PaletteParams> | null
    if (!raw || typeof raw !== 'object') return null
    if (
      !Array.isArray(raw.initColors) ||
      !Array.isArray(raw.targets) ||
      !Array.isArray(raw.evaluators)
    ) {
      return null
    }
    const d = DEFAULT_PARAMS
    // Evaluator fields reach the algorithm directly, so a hand-edited file
    // must not be able to seed it with strings, NaN, or nulls.
    const evaluatorOverrides = (e: Partial<EvaluatorSpec>): Partial<EvaluatorSpec> => ({
      weight: boundedNumber(e.weight, SPEC_DEFAULTS.weight, 0, 1),
      cvd: CVD_TYPES.includes(e.cvd as CvdType) ? (e.cvd as CvdType) : SPEC_DEFAULTS.cvd,
      cvdSeverity: boundedNumber(e.cvdSeverity, SPEC_DEFAULTS.cvdSeverity, 0, 1),
      background: normalizedHex(e.background, SPEC_DEFAULTS.background),
      ratio: boundedNumber(e.ratio, SPEC_DEFAULTS.ratio, 1, 7),
      checkAdjacent: e.checkAdjacent === true,
      avoidRadius: boundedNumber(e.avoidRadius, SPEC_DEFAULTS.avoidRadius, 0.05, 0.5),
      fixEnabled: e.fixEnabled === true,
    })
    const space = raw.colorSpace
    return {
      colorCount: Math.round(boundedNumber(raw.colorCount, d.colorCount, 2, 20)),
      jnd: boundedNumber(raw.jnd, d.jnd, 5, 40),
      maxIterations: Math.round(
        boundedNumber(raw.maxIterations, d.maxIterations, 1_000, 100_000)
      ),
      orderOptimization: raw.orderOptimization !== false,
      behavior: BEHAVIOR_NAMES.find((name) => name === raw.behavior) ?? 'optimize',
      fixStrength: boundedNumber(raw.fixStrength, d.fixStrength, 0, 1),
      initColors: raw.initColors
        .slice(0, IMPORT_LIMITS.initColors)
        .flatMap((c) => {
          const value = normalizeColorValue(c?.value)
          return value
            ? [{ ...newInitColor(value), fixedColor: !!c.fixedColor, fixedOrder: !!c.fixedOrder }]
            : []
        }),
      targets: raw.targets
        .slice(0, IMPORT_LIMITS.targets)
        .flatMap((t) => {
          const value = normalizeColorValue(t?.value)
          return value ? [newTargetColor(value)] : []
        }),
      evaluators: raw.evaluators
        .slice(0, IMPORT_LIMITS.evaluators)
        .filter((e) => EVALUATOR_TYPES.includes(e?.type))
        .map((e: EvaluatorSpec) =>
          newEvaluatorSpec(e.type, {
            ...evaluatorOverrides(e),
            avoidColors: Array.isArray(e.avoidColors)
              ? e.avoidColors.slice(0, IMPORT_LIMITS.avoidColors).flatMap((c) => {
                  const value = normalizeColorValue(c?.value)
                  return value ? [newTargetColor(value)] : []
                })
              : [],
          })
        ),
      colorSpace: parseColorSpace(space),
    }
  } catch {
    return null
  }
}

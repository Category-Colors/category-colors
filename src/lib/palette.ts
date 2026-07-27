import { hexValue, type ColorValue } from '@/lib/color'
import { isWorkingSpace, spaceChannels, spaceInitialRanges, type WorkingSpace } from './color-spaces'
import { CVD_TYPES, EVALUATOR_TYPES } from './evaluators'
import { PRESET_COST_HISTORY } from './preset-history'

export type { WorkingSpace }

// Parameter shapes, defaults, and (de)serialization only — no algorithm.
// Driving categorycolors lives in algorithm.ts so the app shell can import
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

export type CvdType = 'protanomaly' | 'deuteranomaly' | 'tritanomaly'

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
}

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

// The annealer's working space and per-channel bounds. Channel order follows
// the mode (okhsl = h/s/l, oklch = l/c/h, …) — see color-spaces.ts.
export interface ColorSpaceParams {
  mode: WorkingSpace
  ranges: [number, number][]
}

export const defaultColorSpace = (mode: WorkingSpace): ColorSpaceParams => ({
  mode,
  ranges: spaceInitialRanges(mode),
})

export interface PaletteParams {
  colorCount: number
  jnd: number
  maxIterations: number
  orderOptimization: boolean
  initColors: InitColor[]
  targets: TargetColor[]
  evaluators: EvaluatorSpec[]
  colorSpace: ColorSpaceParams
}

// Sampled point on the annealer's loss curve: [iteration, cost]
export type CostSample = [iteration: number, cost: number]

export interface PaletteVersion {
  id: number
  params: PaletteParams
  colors: string[]
  cost: number
  iterations: number
  costHistory: CostSample[]
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
const DEFAULT_EVALUATORS: EvaluatorSpec[] = [
  newEvaluatorSpec('energy', { weight: 0.15 }),
  newEvaluatorSpec('range', { weight: 0.15 }),
  newEvaluatorSpec('jnd', { weight: 0.15 }),
  newEvaluatorSpec('cvd', { weight: 0.15, cvd: 'protanomaly' }),
  newEvaluatorSpec('cvd', { weight: 0.5, cvd: 'deuteranomaly' }),
]

export const DEFAULT_PARAMS: PaletteParams = {
  colorCount: 8,
  jnd: 20,
  maxIterations: 20000,
  orderOptimization: true,
  initColors: [],
  targets: [],
  evaluators: DEFAULT_EVALUATORS,
  colorSpace: defaultColorSpace('okhsl'),
}

// Precomputed with DEFAULT_PARAMS so the app boots instantly instead of
// annealing on load; pressing Generate with untouched settings produces a
// palette of the same character. Regenerate with scripts/regen-preset.cjs
// (keeps colors, cost, iterations, and preset-history.ts in sync).
export const PRESET_PALETTE = {
  colors: ['#864064', '#b79270', '#3377cd', '#8a4025', '#f18ab8', '#aae7ed', '#316c4d', '#c6f078'],
  cost: 0.1703,
  iterations: 13034,
  costHistory: PRESET_COST_HISTORY,
}

// A space is only honored when its mode is known and it carries one range per
// channel of that mode; each bound is clamped to the channel's own limits so a
// hand-edited file can't put the annealer outside the space.
function parseColorSpace(space: Partial<ColorSpaceParams> | undefined): ColorSpaceParams {
  if (!isWorkingSpace(space?.mode)) return defaultColorSpace('okhsl')
  const channels = spaceChannels(space.mode)
  if (!Array.isArray(space.ranges) || space.ranges.length !== channels.length) {
    return defaultColorSpace(space.mode)
  }
  return {
    mode: space.mode,
    ranges: channels.map((channel, i) => {
      const raw = space.ranges![i]
      const clamp = (v: unknown, fallback: number) =>
        typeof v === 'number' && Number.isFinite(v)
          ? Math.min(channel.max, Math.max(channel.min, v))
          : fallback
      const lo = clamp(raw?.[0], channel.initial[0])
      const hi = clamp(raw?.[1], channel.initial[1])
      return lo <= hi ? [lo, hi] : [hi, lo]
    }),
  }
}

// Parse an exported configuration file. Entries get fresh ids so imports
// can't collide with rows created afterwards; malformed entries are dropped.
export function parseParams(text: string): PaletteParams | null {
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
    const num = (v: unknown, fallback: number) =>
      typeof v === 'number' && Number.isFinite(v) ? v : fallback
    // Evaluator fields reach the algorithm directly, so a hand-edited file
    // must not be able to seed it with strings, NaN, or nulls.
    const evaluatorOverrides = (e: Partial<EvaluatorSpec>): Partial<EvaluatorSpec> => ({
      weight: num(e.weight, SPEC_DEFAULTS.weight),
      cvd: CVD_TYPES.includes(e.cvd as CvdType) ? (e.cvd as CvdType) : SPEC_DEFAULTS.cvd,
      cvdSeverity: num(e.cvdSeverity, SPEC_DEFAULTS.cvdSeverity),
      background:
        typeof e.background === 'string' ? e.background : SPEC_DEFAULTS.background,
      ratio: num(e.ratio, SPEC_DEFAULTS.ratio),
      checkAdjacent: e.checkAdjacent === true,
      avoidRadius: num(e.avoidRadius, SPEC_DEFAULTS.avoidRadius),
    })
    const space = raw.colorSpace
    return {
      colorCount: num(raw.colorCount, d.colorCount),
      jnd: num(raw.jnd, d.jnd),
      maxIterations: num(raw.maxIterations, d.maxIterations),
      orderOptimization: raw.orderOptimization !== false,
      initColors: raw.initColors
        .filter((c) => !!c?.value?.space)
        .map((c) => ({ ...newInitColor(c.value), fixedColor: !!c.fixedColor, fixedOrder: !!c.fixedOrder })),
      targets: raw.targets.filter((t) => !!t?.value?.space).map((t) => newTargetColor(t.value)),
      evaluators: raw.evaluators
        .filter((e) => EVALUATOR_TYPES.includes(e?.type))
        .map((e: EvaluatorSpec) =>
          newEvaluatorSpec(e.type, {
            ...evaluatorOverrides(e),
            avoidColors: Array.isArray(e.avoidColors)
              ? e.avoidColors.filter((c) => !!c?.value?.space).map((c) => newTargetColor(c.value))
              : [],
          })
        ),
      colorSpace: parseColorSpace(space),
    }
  } catch {
    return null
  }
}

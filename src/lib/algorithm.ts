import {
  createDefaultConfig,
  evaluators,
  prepareInitialState,
  runSimulatedAnnealing,
  runWithOrderOptimization,
  type Config,
  type EvalFunction,
} from 'category-colors'
// Not in the `evaluators` barrel: its naming table is ~260 kB, so the package
// keeps it on a subpath of its own the way it does saliency's.
import names from 'category-colors/evaluators/names'
import { oklchCss, toCulori, valueToCss } from '@/lib/color'
import { evaluateFix, scheduleFor, toSeed, type FixOptions } from './fix'
import { BEHAVIORS, cvdSeverityFor, isPaused, ordersColors } from './palette'
import type { EvaluatorSpec, PaletteParams } from './palette'
import { buildJndReport } from './report'

// The bridge between the app's serializable params and the category-colors
// algorithm. Kept apart from palette.ts so importing the parameter types and
// defaults doesn't drag the algorithm (and the saliency lookup table) onto the
// initial load — only the worker and the report tab reach for this.

function toEvalFunction(spec: EvaluatorSpec): EvalFunction {
  // 'cvd' is the jnd evaluator scored on a CVD-simulated copy of the palette;
  // 'names' is the one evaluator the barrel does not carry.
  const entry: EvalFunction = {
    function: spec.type === 'names' ? names : evaluators[spec.type === 'cvd' ? 'jnd' : spec.type],
    weight: spec.weight,
  }
  if (spec.type === 'cvd') {
    entry.cvd = { type: spec.cvd, severity: cvdSeverityFor(spec) }
  }
  if (spec.type === 'avoid') {
    entry.colors = spec.avoidColors.map((c) => toCulori(c.value))
    entry.radius = spec.avoidRadius
  }
  if (spec.type === 'contrast') {
    entry.background = spec.background
    entry.ratio = spec.ratio
    entry.checkAdjacent = spec.checkAdjacent
  }
  return entry
}

// Fix mode (see fix.ts): the JND and CVD rows collapse into one fix term that
// checks the same conditions, the spreading terms pause unless switched back
// on, and the rest apply as usual. Without a JND row normal vision goes
// unchecked, as in optimize.

function fixEvalFunctions(active: EvaluatorSpec[], params: PaletteParams): EvalFunction[] {
  const options: FixOptions = {
    seeds: params.initColors.map((c) => toSeed(toCulori(c.value))),
    conditions: active.flatMap((spec) =>
      spec.type === 'jnd' ? [null] : spec.type === 'cvd' ? [{ type: spec.cvd, severity: cvdSeverityFor(spec) }] : []
    ),
  }
  const rest = active.filter((spec) => spec.type !== 'jnd' && spec.type !== 'cvd' && !isPaused(spec, 'fix'))
  return [{ function: evaluateFix, weight: 1, ...options }, ...rest.map(toEvalFunction)]
}

// The algorithm config a set of params describes; shared by generation (in
// the worker) and the stats breakdown (on the main thread).
export function buildConfig(params: PaletteParams): Config {
  const config = createDefaultConfig()
  config.logProgress = false
  config.colorCount = params.colorCount
  config.jnd = params.jnd
  config.maxIterations = params.maxIterations
  config.colorSpace = {
    mode: params.colorSpace.mode,
    ranges: params.colorSpace.ranges.map((windows) => windows.map((w) => [...w])),
  }
  config.similarityTarget = params.targets.map((t) => toCulori(t.value))
  const active = params.evaluators.filter((spec) => spec.weight > 0)
  config.evalFunctions = BEHAVIORS[params.behavior].repairs ? fixEvalFunctions(active, params) : active.map(toEvalFunction)
  return config
}

// A result for colors no run produced: no cost, no curve
const unrun = (colors: string[], seed: number) => ({ colors, cost: 0, iterations: 0, costHistory: [], seed })

// Every run is seeded, so a palette can be made again: the seed drawn here is
// returned with the result for the caller to keep.
export function generatePalette(params: PaletteParams, seed = Math.floor(Math.random() * 2 ** 31)) {
  // Nothing runs: the seeds come back as written, for the report to score
  const rules = BEHAVIORS[params.behavior]
  if (!rules.runs) {
    if (params.initColors.length < 2) throw new Error('Add at least two initial colors to evaluate them.')
    return unrun(params.initColors.map((c) => valueToCss(c.value)), seed)
  }
  const config = buildConfig(params)
  config.recordHistory = true
  config.seed = seed

  const initialState = prepareInitialState(
    {
      colors: params.initColors.map((c) => ({
        color: toCulori(c.value),
        fixedColor: c.fixedColor,
        fixedOrder: c.fixedOrder,
      })),
    },
    config
  )
  // A fix starts partway down the schedule (see scheduleFor). Only the
  // temperature drops: initialTemperature stays the full one, since the step
  // size is scaled against it, so steps start partway down too.
  if (rules.repairs) {
    const { cutoff } = config
    initialState.temperature = cutoff * (initialState.temperature / cutoff) ** scheduleFor(params.fixStrength)
  }
  const run = ordersColors(params) ? runWithOrderOptimization : runSimulatedAnnealing
  const finalState = run(initialState, config)

  // Fixed colors come back as the person wrote them; the rest as OKLCH
  const fixed = new Map(
    params.initColors.filter((c) => c.fixedColor).map((c) => [oklchCss(toCulori(c.value)), valueToCss(c.value)])
  )
  const colors = finalState.colors.map((color) => {
    const css = oklchCss(color)
    return fixed.get(css) ?? css
  })
  // A fix never hands back more issues than it was given. The objective can
  // trade one deep shortfall for two shallow ones, and fitting the seeds to
  // the color space or rounding them to OKLCH can tip a pair that just passed.
  // Then the seeds come back as if nothing ran, without the discarded run's
  // cost and curve. Only when they're a whole palette to fall back to.
  if (rules.repairs && params.initColors.length === colors.length) {
    const seeds = params.initColors.map((c) => valueToCss(c.value))
    const issues = (palette: string[]) => buildJndReport({ params, colors: palette })?.totalIssues ?? 0
    if (issues(colors) > issues(seeds)) return unrun(seeds, seed)
  }
  return {
    colors,
    cost: finalState.cost,
    iterations: finalState.iterations,
    costHistory: finalState.costHistory ?? [],
    seed,
  }
}

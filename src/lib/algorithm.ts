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
import { cvdSeverityFor } from './palette'
import type { EvaluatorSpec, PaletteParams } from './palette'

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
  config.evalFunctions = params.evaluators.filter((spec) => spec.weight > 0).map(toEvalFunction)
  return config
}

// Every run is seeded, so a palette can be made again: the seed drawn here is
// returned with the result for the caller to keep.
export function generatePalette(params: PaletteParams, seed = Math.floor(Math.random() * 2 ** 31)) {
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
  const run = params.orderOptimization ? runWithOrderOptimization : runSimulatedAnnealing
  const finalState = run(initialState, config)

  // Fixed colors come back as the person wrote them; the rest as OKLCH
  const fixed = new Map(
    params.initColors.filter((c) => c.fixedColor).map((c) => [oklchCss(toCulori(c.value)), valueToCss(c.value)])
  )
  return {
    colors: finalState.colors.map((color) => {
      const css = oklchCss(color)
      return fixed.get(css) ?? css
    }),
    cost: finalState.cost,
    iterations: finalState.iterations,
    costHistory: finalState.costHistory ?? [],
    seed,
  }
}

import categorycolors from 'categorycolors/src'
import { toCulori } from '@/lib/color'
import type { CostSample, EvaluatorSpec, PaletteParams } from './palette'

// The bridge between the app's serializable params and the categorycolors
// algorithm. Kept apart from palette.ts so importing the parameter types and
// defaults doesn't drag the algorithm (and its ~470 kB saliency dataset) onto
// the initial load — only the worker and the report tab reach for this.

function toEvalFunction(spec: EvaluatorSpec) {
  // 'cvd' is the jnd evaluator scored on a CVD-simulated copy of the palette
  const entry: Record<string, unknown> = {
    function: categorycolors.evaluators[spec.type === 'cvd' ? 'jnd' : spec.type],
    weight: spec.weight,
  }
  if (spec.type === 'cvd') {
    entry.cvd = { type: spec.cvd, severity: spec.cvdSeverity }
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
export function buildConfig(params: PaletteParams) {
  const config = categorycolors.config.createDefaultConfig()
  config.logProgress = false
  config.colorCount = params.colorCount
  config.jnd = params.jnd
  config.maxIterations = params.maxIterations
  config.colorSpace = {
    mode: params.colorSpace.mode,
    ranges: params.colorSpace.ranges.map((r) => [...r]),
  }
  config.similarityTarget = params.targets.map((t) => toCulori(t.value))
  config.evalFunctions = params.evaluators.filter((spec) => spec.weight > 0).map(toEvalFunction)
  return config
}

export function generatePalette(params: PaletteParams) {
  const config = buildConfig(params)
  config.recordHistory = true

  const state = categorycolors.config.createDefaultState()
  state.colors = params.initColors.map((c) => ({
    color: toCulori(c.value),
    fixedColor: c.fixedColor,
    fixedOrder: c.fixedOrder,
  }))

  const initialState = categorycolors.core.prepareInitialState(state, config)
  const run = params.orderOptimization
    ? categorycolors.core.runWithOrderOptimization
    : categorycolors.core.runSimulatedAnnealing
  const finalState = run(initialState, config)

  return {
    colors: finalState.colors.map(String),
    cost: finalState.cost,
    iterations: finalState.iterations,
    costHistory: (finalState.costHistory ?? []) as CostSample[],
  }
}

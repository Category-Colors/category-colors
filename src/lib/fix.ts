import { converter, differenceCiede2000, parse, type Color } from 'culori'
import { simulateCvd, type CvdSimulation, type Evaluator, type State } from 'category-colors'

// The objective behind the Fix issues behavior: repairs a palette's failing
// pairs without redrawing it. Built here rather than in category-colors, which
// takes any function as an evaluator and stays general-purpose.
//
// Two terms, both linear:
//
// - Shortfall. For each pair under the JND, how far short it falls as a share
//   of the JND, summed across normal vision and each simulation. A passing
//   pair scores 0, so nothing rewards spreading colors that already pass —
//   the `energy`, `range` and `jnd` terms all do, and on a finished palette
//   that is what made colors wander 30-45 ΔE. Linear rather than squared:
//   squaring spreads the effort over many small shortfalls instead of
//   clearing pairs outright, and fixed about a third fewer of them.
// - Pull. Each color's distance from the seed at its position, in JNDs,
//   times PULL. Among fixes that clear the same pairs this prefers the one
//   that moves less. Measured across four preset palettes: 0.1 fixed the most
//   issues and anything lower only added noise.
//
// Positions matter: color i is pulled toward seed i, so the run must keep
// positions (Refine pins every one).
//
// Strength doesn't weigh the pull; it sets how much of the cooling schedule
// the run gets (scheduleFor). A run that starts cooler takes smaller steps and
// accepts fewer worse moves, so it trusts the seeds more. Across six presets
// and three rounds each, starting 60% of the way down moved colors 41% less
// than a stronger pull with about the same issues fixed, and in fewer
// iterations.

const deltaE = differenceCiede2000()
// deltaE converts both arguments to lab65 on every call; converting each
// color once per evaluation instead saves n-2 conversions per color
const lab65 = converter('lab65')
const toLab = (color: Color): Color => lab65(color)!

const PULL = 0.1

// The share of the log-temperature schedule a fix runs: all of it at Strength
// 1 (fixes most), 45% at 0 (moves least). Below about that, starting cooler
// stopped changing the result, so the slider's low end did nothing.
export const scheduleFor = (strength: number) => 0.45 + 0.55 * strength

// The package's Color is culori's color object under its own declaration
const colorsOf = (state: State) => state.colors as unknown as Color[]

export interface FixOptions {
  seeds: (Color | undefined)[]
  // null is normal vision
  conditions: (CvdSimulation | null)[]
}

function shortfall(palette: Color[], jnd: number) {
  const colors = palette.map(toLab)
  let sum = 0
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      sum += Math.max(0, 1 - deltaE(colors[i], colors[j]) / jnd)
    }
  }
  return sum
}

export const evaluateFix: Evaluator = (state, config, descriptor) => {
  const { seeds, conditions } = descriptor as unknown as FixOptions
  const jnd = config.jnd ?? 20
  let cost = 0
  for (const sim of conditions) {
    cost += shortfall(colorsOf(sim ? simulateCvd(state, sim.type, sim.severity) : state), jnd)
  }
  colorsOf(state).map(toLab).forEach((color, i) => {
    const seed = seeds[i]
    if (seed) cost += (PULL * deltaE(color, seed)) / jnd
  })
  return cost
}

// Seeds never change, so they're converted to lab65 once, up front
export const toSeed = (css: Color | string): Color | undefined => {
  const color = typeof css === 'string' ? parse(css) : css
  return color && toLab(color)
}

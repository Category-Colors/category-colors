import categorycolors from 'categorycolors/src'
import { converter } from 'culori'
import { buildConfig } from './algorithm'
import { evaluatorLabel } from './evaluators'
import type { PaletteVersion } from './palette'

const toOklch = converter('oklch')

export interface EvaluatorStat {
  label: string
  weight: number
  score: number
  share: number // fraction of the total weighted cost
}

export interface PaletteStats {
  evaluators: EvaluatorStat[]
  totalCost: number
  minDeltaE: number
  meanDeltaE: number
  // Always measured in oklch, whatever space the run worked in — rgb and
  // oklab have no lightness/chroma channels to report, and a fixed perceptual
  // space keeps the numbers comparable between runs that used different ones.
  lightness: [number, number]
  chroma: [number, number]
}

// Scores the palette with the same evaluators (and weighted average) the
// annealer minimized, plus a few palette-level measurements.
export function computeStats(version: PaletteVersion): PaletteStats | null {
  const { colors, params } = version
  if (colors.length < 2) return null

  const config = buildConfig(params)
  // prepareInitialState runs a temperature search we don't need; one sample
  // keeps it near-free
  config.initialTemperatureSamples = 1

  const state = categorycolors.config.createDefaultState()
  state.colors = colors.map((hex) => ({ color: hex, fixedColor: false, fixedOrder: false }))
  const prepared = categorycolors.core.prepareInitialState(state, config)

  const breakdown = categorycolors.core.costBreakdown(prepared, config)
  // breakdown is positionally aligned with the specs buildConfig kept; the
  // fallback label only guards against the two lists drifting apart
  const activeSpecs = params.evaluators.filter((e) => e.weight > 0)
  const totalCost = breakdown.reduce((sum, b) => sum + b.weightedCost, 0)
  const evaluators = breakdown.map((b, i) => ({
    label: activeSpecs[i] ? evaluatorLabel(activeSpecs[i]) : `Evaluator ${i + 1}`,
    weight: b.weight,
    score: b.cost,
    share: totalCost > 0 ? b.weightedCost / totalCost : 0,
  }))

  const { deltaE } = categorycolors.utils
  let minDeltaE = Infinity
  let sum = 0
  let pairs = 0
  for (let i = 0; i < prepared.colors.length; i++) {
    for (let j = i + 1; j < prepared.colors.length; j++) {
      const d = deltaE(prepared.colors[i], prepared.colors[j], {
        method: 'ciede2000',
        space: 'lab65',
      })
      minDeltaE = Math.min(minDeltaE, d)
      sum += d
      pairs++
    }
  }

  let lMin = Infinity, lMax = -Infinity
  let cMin = Infinity, cMax = -Infinity
  for (const hex of colors) {
    const c = toOklch(hex)
    if (!c) continue
    lMin = Math.min(lMin, c.l)
    lMax = Math.max(lMax, c.l)
    cMin = Math.min(cMin, c.c)
    cMax = Math.max(cMax, c.c)
  }

  return {
    evaluators,
    totalCost,
    minDeltaE,
    meanDeltaE: sum / pairs,
    lightness: [lMin, lMax],
    chroma: [cMin, cMax],
  }
}

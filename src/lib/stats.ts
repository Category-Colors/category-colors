import { costBreakdown, createColor, deltaE } from 'category-colors'
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
  // costBreakdown only reads state.colors, so there is no need to run the
  // colors through prepareInitialState (which would pad, truncate, or clamp
  // them to the config and run a temperature search).
  const prepared = { colors: colors.map((hex) => createColor(hex)), temperature: 0, iterations: 0, cost: 0 }
  const breakdown = costBreakdown(prepared, config)
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

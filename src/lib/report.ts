// Imports the package's report subpath so the tab badge can score a palette
// without pulling in the optimizer or its saliency table (see MainTabs).
import { reportJndIssues, type CvdSimulation, type JndReport, type JndTest } from 'category-colors/report'
import type { PaletteParams, PaletteVersion } from './palette'

export type { JndReport }

// 'normal' → 'No CVD'; CVD labels use the type name alone, adding the
// severity only when two simulations of the same type would collide.
export function testTitles(tests: JndTest[]): string[] {
  const bases = tests.map((t) =>
    t.label === 'normal'
      ? 'No CVD'
      : t.label.charAt(0).toUpperCase() + t.label.slice(1).replace(/:.*$/, '')
  )
  return bases.map((base, i) => {
    if (tests[i].label === 'normal') return base
    const duplicated = bases.filter((b) => b === base).length > 1
    return duplicated ? `${base} · ${tests[i].label.split(':')[1]}` : base
  })
}

// One simulation per active CVD evaluator, deduped — two evaluators with the
// same type and severity would report identical issues.
function cvdSimulationsFor(params: PaletteParams): CvdSimulation[] {
  const seen = new Set<string>()
  return params.evaluators
    .filter((e) => e.type === 'cvd' && e.weight > 0)
    .map((e) => ({ type: e.cvd, severity: e.cvdSeverity }))
    .filter((s) => {
      const key = `${s.type}:${s.severity}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

// ΔE tests for a single palette color against a background color, under the
// same threshold and vision simulations the palette's own report uses.
export function colorVsBackground(color: string, background: string, params: PaletteParams): JndTest[] {
  return reportJndIssues([color, background], {
    jndThreshold: params.jnd,
    cvdSimulations: cvdSimulationsFor(params),
  }).tests
}

// Audits a version with the same criteria it was generated under.
export function buildJndReport(version: PaletteVersion): JndReport | null {
  const { params, colors } = version
  if (colors.length < 2) return null
  return reportJndIssues(colors, {
    jndThreshold: params.jnd,
    cvdSimulations: cvdSimulationsFor(params),
  })
}

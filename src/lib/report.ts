import categorycolors from 'categorycolors/src'
import type { JndReport } from 'categorycolors/src'
import type { PaletteVersion } from './palette'

export type { JndReport, JndTest, JndIssue } from 'categorycolors/src'
import type { JndTest } from 'categorycolors/src'

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

// ΔE tests for a single palette color against a background color, run under
// the same vision simulations as an existing report (labels carry type and
// severity, e.g. "deuteranomaly:0.5").
export function colorVsBackground(
  color: string,
  background: string,
  threshold: number,
  report: JndReport
): JndTest[] {
  const cvdSimulations = report.tests
    .filter((t) => t.label !== 'normal')
    .map((t) => {
      const [type, severity] = t.label.split(':')
      return { type, severity: Number(severity) }
    })
  return categorycolors.reports.reportJndIssues([color, background], {
    jndThreshold: threshold,
    cvdSimulations,
  }).tests
}

// Audits a version with the same criteria it was generated under: its own JND
// threshold, and one simulation per active CVD evaluator (deduped — two
// evaluators with the same type and severity would report identical issues).
export function buildJndReport(version: PaletteVersion): JndReport | null {
  const { params, colors } = version
  if (colors.length < 2) return null

  const seen = new Set<string>()
  const cvdSimulations = params.evaluators
    .filter((e) => e.type === 'cvd' && e.weight > 0)
    .map((e) => ({ type: e.cvd, severity: e.cvdSeverity }))
    .filter((s) => {
      const key = `${s.type}:${s.severity}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  return categorycolors.reports.reportJndIssues(colors, {
    jndThreshold: params.jnd,
    cvdSimulations,
  })
}

// Imports the package's report subpath so the tab badge can score a palette
// without pulling in the optimizer or its saliency table (see MainTabs).
import { reportJndIssues, type CvdSimulation, type JndReport, type JndTest } from 'category-colors/report'
import { hexValue, parseCssColor, valueToCss } from './color'
import { cvdSeverityFor, fittedTo, newInitColor } from './palette'
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
    .map((e) => ({ type: e.cvd, severity: cvdSeverityFor(e) }))
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
export function buildJndReport(version: Pick<PaletteVersion, 'params' | 'colors'>): JndReport | null {
  const { params, colors } = version
  if (colors.length < 2) return null
  return reportJndIssues(colors, {
    jndThreshold: params.jnd,
    cvdSimulations: cvdSimulationsFor(params),
  })
}

// The fewest colors that touch every failing pair, greedily: free whichever
// color sits in the most uncovered pairs until none are left. Freeing every
// color in any failing pair would free nearly all of them, since each CVD
// simulation fails a different handful of pairs. Pinned colors are never
// freed, so a pair between two of them stays as it is.
function colorsToFree(version: Pick<PaletteVersion, 'params' | 'colors'>, pinned: Set<number>): Set<number> {
  let pairs = (buildJndReport(version)?.tests.flatMap((t) => t.issues.map((p) => [p.indexA, p.indexB])) ?? [])
    .map((pair) => pair.filter((i) => !pinned.has(i)))
    .filter((pair) => pair.length)
  const free = new Set<number>()
  while (pairs.length) {
    const counts = new Map<number, number>()
    for (const i of pairs.flat()) counts.set(i, (counts.get(i) ?? 0) + 1)
    const worst = [...counts].reduce((a, b) => (b[1] > a[1] ? b : a))[0]
    free.add(worst)
    pairs = pairs.filter((pair) => !pair.includes(worst))
  }
  return free
}

// Params that repair a version rather than replace it: its colors become the
// seeds, the colors behind its failing pairs are free to move and the rest are
// fixed, every position is pinned so categories keep their colors (fix mode
// holds each color near the seed at its position), and the evaluators switch
// to fixing issues. The color space stretches to hold every color, so none is
// moved before the run starts. Seeds the person fixed stay fixed; they come
// back from a run exactly as written, so they're found by value. With nothing
// failing, everything is fixed and a fix has nothing to do.
export function refineParams(version: Pick<PaletteVersion, 'params' | 'colors'>): PaletteParams {
  const pinnedCss = new Set(version.params.initColors.filter((c) => c.fixedColor).map((c) => valueToCss(c.value)))
  const pinned = new Set(version.colors.flatMap((css, i) => (pinnedCss.has(css) ? [i] : [])))
  const free = colorsToFree(version, pinned)
  return {
    ...fittedTo(structuredClone(version.params), version.colors),
    behavior: 'fix',
    initColors: version.colors.map((css, i) => ({
      ...newInitColor(parseCssColor(css) ?? hexValue('#888888')),
      fixedColor: !free.has(i),
      fixedOrder: true,
    })),
  }
}

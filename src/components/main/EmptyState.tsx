import { DEFAULT_PARAMS, defaultColorSpace, type PaletteParams } from '@/lib/palette'
import { PRESET_PALETTES } from '@/lib/presets'

// The essay this app implements
const ESSAY = 'https://mattstromawn.com/writing/how-to-pick-the-least-wrong-colors/'

const STEPS = [
  ['Configure', 'Colors, space, and evaluators, on the ← left.'],
  ['Generate', 'The optimizer picks colors that stay apart.'],
  ['Refine', 'Preview on live charts, read the report, edit any color.'],
  ['Export', 'Copy or download, on the right →.'],
] as const

// Presets of the panel's own settings: a count plus OKHSL saturation and
// lightness bands, over the defaults. The panel adopts them, so each is also a
// worked example of step 1. (PRESET_PALETTES below are finished palettes.)
const PARAM_PRESETS: { label: string; count: number; s: [number, number]; l: [number, number] }[] = [
  { label: 'Vivid', count: 8, s: [0.75, 1], l: [0.5, 0.75] },
  { label: 'Dusky', count: 12, s: [0.2, 0.5], l: [0.25, 0.55] },
  { label: 'Pastel', count: 6, s: [0.35, 0.65], l: [0.78, 0.92] },
]

const presetParams = (p: (typeof PARAM_PRESETS)[number]): PaletteParams => {
  const space = defaultColorSpace('okhsl')
  return {
    ...DEFAULT_PARAMS,
    colorCount: p.count,
    colorSpace: { ...space, ranges: [space.ranges[0], p.s, p.l] },
  }
}

// The canvas before any palette exists: four steps and ways to start.
export function EmptyState({
  busy,
  onGenerate,
  onPreset,
}: {
  busy: boolean
  onGenerate: (params?: PaletteParams) => void
  onPreset: (colors: string[]) => void
}) {
  return (
    <section className="empty-state dialkit-root" aria-labelledby="empty-title">
      <h2 id="empty-title" className="empty-title">
        Pick colors the{' '}
        <a href={ESSAY} target="_blank" rel="noreferrer">
          least wrong
        </a>{' '}
        way
      </h2>
      <ol className="empty-steps">
        {STEPS.map(([name, detail], i) => (
          <li key={name}>
            <span className="empty-step-n">{i + 1}</span>
            <span className="empty-step-name">{name}</span>
            <span className="empty-step-detail">{detail}</span>
          </li>
        ))}
      </ol>
      <div className="empty-starts">
        <div className="empty-start">
          <span className="empty-starts-label">Try a preset</span>
          <div className="empty-chips">
            {PARAM_PRESETS.map((p) => (
              <button
                key={p.label}
                className="empty-chip"
                disabled={busy}
                onClick={() => onGenerate(presetParams(p))}
              >
                {p.label}
                <span>{p.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="empty-start">
          <span className="empty-starts-label">Or load an existing palette</span>
          <div className="empty-chips">
            {PRESET_PALETTES.slice(0, 3).map((p) => (
              <button
                key={p.name}
                className="empty-chip"
                disabled={busy}
                onClick={() => onPreset(p.colors)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

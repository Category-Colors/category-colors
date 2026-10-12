import { PARAM_PRESETS, presetParams, type PaletteParams } from '@/lib/palette'
import { PRESET_PALETTES } from '@/lib/presets'
import { useIsPhone } from '@/lib/use-media'

// The essay this app implements
const ESSAY = 'https://mattstromawn.com/writing/how-to-pick-the-least-wrong-colors/'

// Two steps point at where their controls actually are, and on a phone that
// isn't left and right — both panels open from the toolbar below, whose
// buttons carry no labels to name. So the phone copy points at the toolbar and
// lets the icons introduce themselves; the arrows would be pointing off the
// side of the screen either way.
const steps = (phone: boolean) =>
  [
    [
      'Configure',
      phone
        ? 'Colors, space, and evaluators, from the toolbar below ↓.'
        : 'Colors, space, and evaluators, on the ← left.',
    ],
    ['Generate', 'The algorithm optimizes your color palette.'],
    ['Refine', 'Preview on live charts, read the report, edit any color.'],
    [
      'Export',
      phone ? 'Copy or download, from the toolbar below ↓.' : 'Copy or download, on the right →.',
    ],
  ] as const

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
  const phone = useIsPhone()
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
        {steps(phone).map(([name, detail], i) => (
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

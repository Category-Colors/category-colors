import type { ReactNode } from 'react'

// Placeholders for the six dashboard charts, shown while the Open-Meteo
// request is in flight. Each one mirrors its chart's real geometry — same
// viewBox, same padding, same bar counts — so the card doesn't resize when the
// data lands; only the marks change. Everything is drawn in ink at a low alpha
// rather than in the palette, which keeps the colors themselves as the payoff
// of the load and stops a skeleton from ever being mistaken for a reading.

/**
 * Deterministic pseudo-noise in roughly -1..1. Not Math.random: the shapes
 * have to survive re-renders (the palette can change while the fetch is still
 * out) without jittering, and summed sines read as plausible measurements
 * where a single sine reads as decoration.
 */
const noise = (i: number, seed: number) =>
  (Math.sin(i * 0.7 + seed * 2.4) +
    Math.sin(i * 0.23 + seed * 5.1) * 0.6 +
    Math.sin(i * 1.7 + seed * 1.3) * 0.25) /
  1.85

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

// aria-hidden throughout: the loading state is announced once by the status
// line in Dashboard, not six times by decorative geometry.
const Skeleton = ({ children }: { children: ReactNode }) => (
  <div className="chart-skeleton" aria-hidden>
    {children}
  </div>
)

/** Stand-in for an axis label — the real text would be wrong, a pill is honest. */
const LabelPill = ({ x, y, w = 18 }: { x: number; y: number; w?: number }) => (
  <rect x={x} y={y} width={w} height={6} rx={3} fill="currentColor" fillOpacity={0.08} />
)

// ── Temperature lines ─────────────────────────────────────────

const TL = { W: 1120, H: 300, PAD: { top: 14, right: 48, bottom: 26, left: 36 } }

export function TempLinesSkeleton({ count }: { count: number }) {
  const { W, H, PAD } = TL
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const N = 84
  const rows = 6
  const x = (i: number) => PAD.left + (i / (N - 1)) * plotW
  const gridY = (r: number) => PAD.top + (plotH * r) / (rows - 1)
  const dayX = (d: number) => PAD.left + (plotW * d) / 7

  const paths = range(count).map((s) => {
    const band = PAD.top + plotH * (0.14 + (0.68 * s) / Math.max(count - 1, 1))
    return range(N)
      .map((i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${(band + noise(i, s) * plotH * 0.09).toFixed(1)}`)
      .join(' ')
  })

  return (
    <Skeleton>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full text-ink">
        {range(rows).map((r) => (
          <g key={r}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={gridY(r)}
              y2={gridY(r)}
              stroke="currentColor"
              strokeOpacity={0.06}
            />
            <LabelPill x={PAD.left - 20} y={gridY(r) - 3} w={14} />
          </g>
        ))}
        {range(7).map((d) => (
          <g key={d}>
            {d > 0 && (
              <line
                x1={dayX(d)}
                x2={dayX(d)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="currentColor"
                strokeOpacity={0.04}
              />
            )}
            <LabelPill x={dayX(d) + plotW / 14 - 9} y={H - 13} />
          </g>
        ))}
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.09}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>
    </Skeleton>
  )
}

// ── Solar stream ──────────────────────────────────────────────

const SS = { W: 1120, H: 240, PAD: { top: 10, right: 10, bottom: 26, left: 10 } }

export function SolarStreamSkeleton({ count }: { count: number }) {
  const { W, H, PAD } = SS
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const N = 96
  const x = (i: number) => PAD.left + (i / (N - 1)) * plotW

  // Daily solar bumps, stacked and centred on their own total — the same
  // silhouette the wiggle baseline produces, without the optimisation.
  const series = range(count).map((s) =>
    range(N).map((i) => {
      const day = Math.max(0, Math.sin((i / N) * Math.PI * 7 - s * 0.8))
      return 0.15 + day * (0.7 + 0.3 * noise(i, s + 3))
    })
  )
  const totals = range(N).map((i) => series.reduce((sum, v) => sum + v[i], 0))
  const peak = Math.max(...totals)
  const Y = (v: number) => PAD.top + plotH * (0.5 - v / (peak * 1.05))

  const bands = series.map((_, s) => {
    const below = range(N).map((i) => series.slice(0, s).reduce((sum, v) => sum + v[i], 0))
    const top = range(N).map((i) => below[i] + series[s][i])
    let d = ''
    for (let i = 0; i < N; i++) d += `${i ? 'L' : 'M'}${x(i).toFixed(1)},${Y(top[i] - totals[i] / 2).toFixed(1)}`
    for (let i = N - 1; i >= 0; i--) d += `L${x(i).toFixed(1)},${Y(below[i] - totals[i] / 2).toFixed(1)}`
    return `${d}Z`
  })

  return (
    <Skeleton>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full text-ink">
        {range(7).map((d) => (
          <LabelPill key={d} x={PAD.left + (plotW * (d + 0.5)) / 7 - 9} y={H - 13} />
        ))}
        {bands.map((d, i) => (
          <path key={i} d={d} fill="currentColor" fillOpacity={i % 2 ? 0.05 : 0.08} />
        ))}
      </svg>
    </Skeleton>
  )
}

// ── Climate scatter ───────────────────────────────────────────

const CS = { W: 540, H: 300, PAD: { top: 10, right: 12, bottom: 26, left: 34 } }
const DOT_R = 2.3
const dot = (cx: number, cy: number) =>
  `M${cx.toFixed(1)},${cy.toFixed(1)}m-${DOT_R},0a${DOT_R},${DOT_R} 0 1,0 ${DOT_R * 2},0a${DOT_R},${DOT_R} 0 1,0 -${DOT_R * 2},0`

export function ClimateScatterSkeleton({ count }: { count: number }) {
  const { W, H, PAD } = CS
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const PER = 34

  // One loose cloud per series, placed on a golden-angle spiral: it fills the
  // plot evenly with no axis bias. Walking them along a diagonal instead read
  // as a strong positive correlation, which is both an assertion a placeholder
  // has no business making and the opposite of the way temperature and
  // humidity usually run.
  const GOLDEN = 2.399963
  const clouds = range(count).map((s) => {
    const r = Math.sqrt((s + 0.5) / count) * 0.34
    const cx = PAD.left + plotW * (0.5 + r * Math.cos(s * GOLDEN))
    const cy = PAD.top + plotH * (0.5 + r * Math.sin(s * GOLDEN))
    // x and y read the noise at different frequencies as well as different
    // offsets — sharing a frequency traces a Lissajous figure, which showed up
    // as visible filaments inside each cloud rather than a spread of dots
    return range(PER)
      .map((i) => dot(cx + noise(i, s) * plotW * 0.11, cy + noise(i * 1.37 + 11, s + 13) * plotH * 0.14))
      .join('')
  })

  return (
    <Skeleton>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full text-ink">
        {range(4).map((r) => {
          const y = PAD.top + (plotH * r) / 3
          return (
            <g key={r}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.06}
              />
              <LabelPill x={PAD.left - 22} y={y - 3} w={16} />
            </g>
          )
        })}
        {range(5).map((c) => (
          <LabelPill key={c} x={PAD.left + (plotW * c) / 4 - 7} y={H - 13} w={14} />
        ))}
        {clouds.map((d, i) => (
          <path key={i} d={d} fill="currentColor" fillOpacity={0.07} />
        ))}
      </svg>
    </Skeleton>
  )
}

// ── Sunshine bars (grouped, one group per day) ────────────────

const BAR_H = 190
const BAR_TOP = 14

const GridLines = ({ label }: { label: number }) => (
  <>
    {[0.25, 0.5, 0.75, 1].map((f) => (
      <div
        key={f}
        className="absolute inset-x-0 border-t border-ink/[0.06]"
        style={{ top: BAR_TOP + (BAR_H - BAR_TOP) * (1 - f) }}
      >
        <span
          className="absolute -top-[5px] right-0 block h-[6px] rounded-full bg-ink/[0.08]"
          style={{ width: label }}
        />
      </div>
    ))}
  </>
)

export function SunshineBarsSkeleton({ count }: { count: number }) {
  return (
    <Skeleton>
      <div className="flex flex-col gap-2">
        <div className="relative" style={{ height: BAR_H }}>
          <GridLines label={16} />
          <div className="absolute inset-x-0 bottom-0 flex gap-3" style={{ top: BAR_TOP }}>
            {range(7).map((d) => (
              <div key={d} className="flex h-full flex-1 items-end justify-center gap-[2px]">
                {range(count).map((i) => (
                  <div
                    key={i}
                    className="max-w-3 flex-1 rounded-t-[3px] bg-ink/[0.07]"
                    style={{ height: `${34 + noise(d * 3, i) * 26 + 24}%` }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          {/* same classes as the real weekday labels, so the row keeps a
              10px text line box — a bare flexed pill collapses to its own
              6px and shortens the card by 4.5px when the data swaps in */}
          {range(7).map((d) => (
            <span key={d} className="flex-1 text-center tabular-nums text-[10px]">
              <span className="inline-block h-[6px] w-5 rounded-full bg-ink/[0.08]" />
            </span>
          ))}
        </div>
      </div>
    </Skeleton>
  )
}

// ── Precipitation bars (one per city) ─────────────────────────

export function PrecipBarsSkeleton({ count }: { count: number }) {
  return (
    <Skeleton>
      <div className="flex flex-col gap-2">
        <div className="relative" style={{ height: BAR_H }}>
          <GridLines label={22} />
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-[2px]" style={{ top: BAR_TOP }}>
            {range(count).map((i) => (
              <div key={i} className="flex h-full flex-1 items-end justify-center">
                <div
                  className="w-full max-w-10 rounded-t-[4px] bg-ink/[0.07]"
                  style={{ height: `${46 + noise(i * 5, i) * 34}%` }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-[2px]">
          {range(count).map((i) => (
            <div key={i} className="flex flex-1 justify-center">
              <span className="block h-[15px] w-7 rounded-[5px] bg-ink/[0.08]" />
            </div>
          ))}
        </div>
      </div>
    </Skeleton>
  )
}

// ── Share of sunshine (one stacked bar + legend) ──────────────

export function SunShareSkeleton({ count }: { count: number }) {
  const widths = range(count).map((i) => 1 + (noise(i * 7, i) + 1) * 0.9)
  const total = widths.reduce((sum, w) => sum + w, 0)

  return (
    <Skeleton>
      <div className="flex flex-col gap-3">
        <div className="flex h-7 gap-[2px] overflow-hidden rounded-md">
          {widths.map((w, i) => (
            <div key={i} className="bg-ink/[0.07]" style={{ width: `${(w / total) * 100}%` }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {range(count).map((i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="block h-[15px] w-7 rounded-[5px] bg-ink/[0.08]" />
              <span className="block h-[6px] w-6 rounded-full bg-ink/[0.08]" />
            </span>
          ))}
        </div>
      </div>
    </Skeleton>
  )
}

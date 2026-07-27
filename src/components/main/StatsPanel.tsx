import { Fragment, useId, useMemo } from 'react'
import { computeStats } from '@/lib/stats'
import type { CostSample, PaletteVersion } from '@/lib/palette'

const fmt = (v: number, digits = 3) => (Number.isFinite(v) ? v.toFixed(digits) : '—')

const fmtCost = (v: number) =>
  v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toFixed(3)

// Loss curve in normalized coordinates (viewBox 0–100, stretched to fit) with
// non-scaling strokes; the start/max/min/end markers live in the HTML overlay
// so they don't distort with the aspect ratio.
function LossGraph({ history }: { history: CostSample[] }) {
  const fillId = useId()

  if (history.length < 2) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="tabular-nums text-[11px] text-ink/35">no loss history for this version</p>
      </div>
    )
  }

  // a flat-zero curve (or a single-iteration run) has no scale to normalize
  // against; fall back to 1 so the polyline stays on the baseline
  const maxCost = Math.max(...history.map(([, c]) => c)) || 1
  const maxIter = history[history.length - 1][0] || 1
  const points = history
    .map(([i, c]) => `${((i / maxIter) * 100).toFixed(2)},${(100 - (c / maxCost) * 100).toFixed(2)}`)
    .join(' ')

  let maxIdx = 0
  let minIdx = 0
  history.forEach(([, c], i) => {
    if (c > history[maxIdx][1]) maxIdx = i
    if (c < history[minIdx][1]) minIdx = i
  })
  const endIdx = history.length - 1
  const pos = (idx: number) => ({
    x: (history[idx][0] / maxIter) * 100,
    y: 100 - (history[idx][1] / maxCost) * 100,
  })

  // start and end always show; max/min only when they aren't one of those
  // points already (min also skipped near the right edge, where it would
  // collide with the end label)
  const markers: { name: string; idx: number }[] = [{ name: 'start', idx: 0 }]
  if (maxIdx !== 0 && maxIdx !== endIdx) markers.push({ name: 'max', idx: maxIdx })
  if (minIdx !== 0 && minIdx !== endIdx && pos(minIdx).x < 80) {
    markers.push({ name: 'min', idx: minIdx })
  }
  markers.push({ name: 'end', idx: endIdx })

  return (
    <div className="relative min-h-[150px] flex-1">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full text-ink"
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.13} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        {[25, 50, 75].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke="currentColor"
            strokeOpacity={0.06}
            strokeDasharray="2 4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <line
          x1="0"
          y1="100"
          x2="100"
          y2="100"
          stroke="currentColor"
          strokeOpacity={0.12}
          vectorEffect="non-scaling-stroke"
        />
        <polygon points={`0,100 ${points} 100,100`} fill={`url(#${fillId})`} />
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.75}
          strokeWidth="1.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {markers.map(({ name, idx }) => {
        const { x, y } = pos(idx)
        // dot sits on the true point; text is vertically clamped into view
        // and flips to the left of the dot near the right edge
        const textY = Math.min(90, Math.max(6, y))
        const flip = x > 72
        return (
          <Fragment key={name}>
            <span
              className="absolute size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/80"
              style={{ left: `${x}%`, top: `${y}%` }}
            />
            <span
              className={`absolute -translate-y-1/2 rounded-sm bg-panel/95 px-1 py-px tabular-nums text-[9px] whitespace-nowrap text-ink/60 ${
                flip ? '-translate-x-[calc(100%+7px)]' : 'translate-x-[7px]'
              }`}
              style={{ left: `${x}%`, top: `${textY}%` }}
            >
              {name} {fmtCost(history[idx][1])}
            </span>
          </Fragment>
        )
      })}
    </div>
  )
}

export function StatsPanel({ version }: { version: PaletteVersion }) {
  const stats = useMemo(() => computeStats(version), [version])

  if (!stats) {
    return (
      <div className="flex min-h-[206px] flex-1 items-center justify-center rounded-[10px] bg-ink/5 p-6">
        <p className="tabular-nums text-[11px] text-ink/40">
          stats need at least two colors in the palette
        </p>
      </div>
    )
  }

  const maxShare = Math.max(...stats.evaluators.map((e) => e.share), 0.0001)
  const summary: [string, string][] = [
    ['min pair ΔE', fmt(stats.minDeltaE, 1)],
    ['mean pair ΔE', fmt(stats.meanDeltaE, 1)],
    ['L range', `${fmt(stats.lightness[0], 2)}–${fmt(stats.lightness[1], 2)}`],
    ['C range', `${fmt(stats.chroma[0], 2)}–${fmt(stats.chroma[1], 2)}`],
  ]

  return (
    <div className="@container flex flex-1">
      <div className="flex min-h-[206px] flex-1 flex-col gap-6 rounded-[10px] bg-ink/5 p-5 @min-[560px]:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[10px] font-medium tracking-[0.08em] text-ink/30 uppercase">
                <th className="pb-1.5 text-left font-medium">Evaluator</th>
                <th className="pb-1.5 text-right font-medium">wt</th>
                <th className="pb-1.5 text-right font-medium">score</th>
                <th className="pb-1.5 text-right font-medium">share</th>
              </tr>
            </thead>
            <tbody>
              {stats.evaluators.map((e, i) => (
                <tr key={i} className="border-t border-ink/5">
                  <td className="py-1 pr-2 text-[12px] whitespace-nowrap text-ink/80">{e.label}</td>
                  <td className="py-1 pl-2 text-right tabular-nums text-[11px] text-ink/50">
                    {e.weight.toFixed(2)}
                  </td>
                  <td className="py-1 pl-2 text-right tabular-nums text-[11px] text-ink/70">
                    {fmt(e.score)}
                  </td>
                  <td className="py-1 pl-3">
                    <span className="flex items-center justify-end gap-1.5">
                      <span className="h-[3px] w-10 overflow-hidden rounded-full bg-ink/[0.07]">
                        <span
                          className="block h-full rounded-full bg-ink/40"
                          style={{ width: `${(e.share / maxShare) * 100}%` }}
                        />
                      </span>
                      <span className="w-7 text-right tabular-nums text-[11px] text-ink/45">
                        {Math.round(e.share * 100)}%
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-ink/10">
                <td className="py-1 pr-2 text-[12px] text-ink/95">Total cost</td>
                <td />
                <td className="py-1 pl-2 text-right tabular-nums text-[11px] text-ink/95">
                  {fmt(stats.totalCost, 4)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {summary.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] text-ink/45">{label}</span>
                <span className="tabular-nums text-[11px] text-ink/70">{value}</span>
              </div>
            ))}
          </div>
        </div>
        <LossGraph history={version.costHistory} />
      </div>
    </div>
  )
}

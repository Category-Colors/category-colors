import { useMemo, useRef } from 'react'
import type { CityWeather } from '@/lib/weather'
import { ChartTip, type Tip } from './ChartTip'
import { clampIndex, svgPoint, useChartUnit, useHoverState } from './chart-geometry'

const WIDTH = 1120
const HEIGHT = 240
const PAD = { top: 10, right: 10, bottom: 26, left: 10 }

// This axis is UTC, not local, so it can't share chart-geometry's weekday.
// Kept rather than rebuilt: the hover handler formats on every pointer move.
const WEEKDAY_UTC = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' })

// Byron & Wattenberg wiggle offset (as in d3 stackOffsetWiggle): picks the
// baseline that minimizes weighted wobble of the layers.
function wiggleBaseline(series: number[][]): number[] {
  const m = series[0].length
  const base = new Array<number>(m).fill(0)
  let y = 0
  for (let t = 1; t < m; t++) {
    let sum = 0
    let wobble = 0
    let run = 0
    for (const s of series) {
      const delta = s[t] - s[t - 1]
      wobble += (run + delta / 2) * s[t]
      run += delta
      sum += s[t]
    }
    if (sum) y -= wobble / sum
    base[t] = y
  }
  return base
}

export function SolarStream({
  cities,
  colors,
}: {
  cities: CityWeather[]
  colors: string[]
}) {
  // Realign each city's local-time hours onto a shared UTC axis. Series start
  // at different UTC instants (each city's own local midnight), so clip to the
  // window every city covers.
  const ref = Math.max(...cities.map((c) => c.startUtcMs))
  const lead = cities.map((c) => Math.round((ref - c.startUtcMs) / 3600_000))
  const m = Math.min(...lead.map((l, i) => cities[i].hourlyRadiation.length - l))

  const svgRef = useRef<SVGSVGElement>(null)
  useChartUnit(svgRef, WIDTH)

  // `bands` keeps the stacked edges in screen units so hover can ask which
  // layer contains the cursor without re-deriving the baseline every move.
  const { paths, dayTicks, bands, series, x } = useMemo(() => {
    const series = cities.map((c, i) =>
      Array.from({ length: m }, (_, j) => c.hourlyRadiation[lead[i] + j] ?? 0)
    )
    const base = wiggleBaseline(series)

    const stacked = series.map(() => ({
      y0: new Array<number>(m),
      y1: new Array<number>(m),
    }))
    for (let t = 0; t < m; t++) {
      let y = base[t]
      series.forEach((s, i) => {
        stacked[i].y0[t] = y
        y += s[t]
        stacked[i].y1[t] = y
      })
    }

    const lo = Math.min(...base)
    const hi = Math.max(...stacked[stacked.length - 1].y1)
    const plotW = WIDTH - PAD.left - PAD.right
    const plotH = HEIGHT - PAD.top - PAD.bottom
    const x = (j: number) => PAD.left + (j / (m - 1)) * plotW
    const Y = (v: number) => PAD.top + plotH * (1 - (v - lo) / (hi - lo || 1))

    const bands = stacked.map(({ y0, y1 }) => ({ top: y1.map(Y), bottom: y0.map(Y) }))

    const paths = bands.map(({ top, bottom }) => {
      let d = ''
      for (let j = 0; j < m; j++) d += `${j ? 'L' : 'M'}${x(j).toFixed(1)},${top[j].toFixed(1)}`
      for (let j = m - 1; j >= 0; j--) d += `L${x(j).toFixed(1)},${bottom[j].toFixed(1)}`
      return d + 'Z'
    })

    const DAY = 86_400_000
    const firstMidnight = Math.ceil(ref / DAY) * DAY
    const end = ref + m * 3600_000
    const dayTicks = []
    for (let t = firstMidnight; t + 12 * 3600_000 < end; t += DAY) {
      const u = (t - ref) / 3600_000
      dayTicks.push({
        boundaryX: u > 0 ? x(u) : null,
        labelX: x(u + 12),
        label: WEEKDAY_UTC.format(t),
      })
    }

    return { paths, dayTicks, bands, series, x }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities])

  // Hovering a stack reads the whole column: every city's radiation at that
  // hour, listed top band first so the tooltip order matches what is on
  // screen. The band actually under the cursor is marked active; above or
  // below the stack there is no active band, only the column.
  const [hover, setHover] = useHoverState<Tip & { j: number; c: number }>(cities)
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const { vx, vy } = svgPoint(e, WIDTH, HEIGHT)
    const j = clampIndex(((vx - PAD.left) / (WIDTH - PAD.left - PAD.right)) * (m - 1), m - 1)
    // Bands are contiguous, so the first one straddling the cursor is the one
    // under it. Index 0 stacks lowest, which puts it last on screen.
    const c = bands.findIndex((b) => vy >= b.top[j] && vy <= b.bottom[j])
    const order = cities.map((_, ci) => ci).reverse()
    const at = new Date(ref + j * 3600_000)
    setHover({
      j,
      c,
      x: e.clientX,
      y: e.clientY,
      title:
        `${WEEKDAY_UTC.format(at)} ` +
        `${String(at.getUTCHours()).padStart(2, '0')}:00 UTC · W/m²`,
      active: c < 0 ? undefined : order.indexOf(c),
      rows: order.map((ci) => ({
        color: colors[ci],
        label: cities[ci].name,
        value: `${Math.round(series[ci][j])}`,
      })),
    })
  }

  // Only the crosshair moves with the pointer; the bands and day rules are
  // rebuilt once per palette, not once per move.
  const chrome = useMemo(
    () => (
      <>
        {dayTicks.map((tick) => (
          <g key={tick.label + tick.labelX}>
            {tick.boundaryX !== null && (
              <line
                x1={tick.boundaryX}
                x2={tick.boundaryX}
                y1={PAD.top}
                y2={HEIGHT - PAD.bottom}
                stroke="currentColor"
                strokeOpacity={0.05}
              />
            )}
            <text
              x={tick.labelX}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-ink/35 tabular-nums"
            >
              {tick.label}
            </text>
          </g>
        ))}
        {paths.map((d, i) => (
          <path
            key={cities[i].code}
            d={d}
            fill={colors[i]}
            stroke={colors[i]}
            strokeWidth={1}
            className="transition-colors duration-300"
          />
        ))}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayTicks, paths, cities, colors]
  )

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="chart-svg block w-full cursor-crosshair text-ink"
        role="img"
        aria-label={`Stacked shortwave radiation for ${cities.map((c) => c.name).join(', ')}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onPointerCancel={() => setHover(null)}
      >
        {chrome}
        {hover && (
          <g pointerEvents="none">
            <line
              x1={x(hover.j)}
              x2={x(hover.j)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke="currentColor"
              strokeOpacity={0.2}
            />
            {hover.c >= 0 && (
              <circle
                cx={x(hover.j)}
                cy={(bands[hover.c].top[hover.j] + bands[hover.c].bottom[hover.j]) / 2}
                r={4}
                fill={colors[hover.c]}
                className="stroke-panel"
                strokeWidth={1.5}
              />
            )}
          </g>
        )}
      </svg>
      {hover && <ChartTip {...hover} />}
    </>
  )
}

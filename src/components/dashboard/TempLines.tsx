import { useMemo, useRef } from 'react'
import type { CityWeather } from '@/lib/weather'
import { ChartTip, type Tip } from './ChartTip'
import { clampIndex, svgPoint, useChartUnit, useHoverState, weekday } from './chart-geometry'
import { useIsPhone } from '@/lib/use-media'

const HEIGHT = 300
// The viewBox is the chart's aspect ratio as much as its coordinate system:
// it is `w-full` with the default preserveAspectRatio, so 1120 units across
// 300 down is a 3.7:1 band — a fine shape on a desk, and 97px tall on a phone.
// Halving the width gives the same data a 1.9:1 box there. It also puts the
// chrome back in proportion: `--u` keeps the labels 10px however wide the
// chart is drawn, but PAD is in user units, and at 1120-across-a-phone the
// gutter reserved for a label had shrunk to a third of the label.
const WIDE = 1120
const NARROW = 560
const PAD = { top: 14, right: 48, bottom: 26, left: 36 }


export function TempLines({
  cities,
  days,
  colors,
}: {
  cities: CityWeather[]
  days: string[]
  colors: string[]
}) {
  const WIDTH = useIsPhone() ? NARROW : WIDE
  const all = cities.flatMap((c) => c.hourlyTemp)
  const rawLo = Math.floor(Math.min(...all) / 5) * 5
  const rawHi = Math.ceil(Math.max(...all) / 5) * 5
  const lo = rawLo === rawHi ? rawLo - 5 : rawLo
  const hi = rawLo === rawHi ? rawHi + 5 : rawHi
  const step = hi - lo > 25 ? 10 : 5
  const plotW = WIDTH - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const n = cities[0].hourlyTemp.length
  const x = (i: number) => PAD.left + (i / (n - 1)) * plotW
  const y = (v: number) => PAD.top + plotH * (1 - (v - lo) / (hi - lo))

  const svgRef = useRef<SVGSVGElement>(null)
  useChartUnit(svgRef, WIDTH)

  const paths = useMemo(
    () =>
      cities.map((city) =>
        city.hourlyTemp
          .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
          .join(' ')
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cities, lo, hi, WIDTH]
  )

  // The cursor picks an hour, and the tooltip reads that whole column: every
  // city's temperature at that hour, warmest first, which is the order the
  // lines themselves sit in. The nearest line is marked active — hit-testing
  // the strokes instead would just report whichever path is drawn on top.
  const [hover, setHover] = useHoverState<Tip & { i: number; c: number }>(cities)
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const { vx, vy } = svgPoint(e, WIDTH, HEIGHT)
    const i = clampIndex(((vx - PAD.left) / plotW) * (n - 1), n - 1)
    let c = 0
    let best = Infinity
    cities.forEach((city, ci) => {
      const d = Math.abs(y(city.hourlyTemp[i]) - vy)
      if (d < best) {
        best = d
        c = ci
      }
    })
    // Every city's hour i is its own local hour i % 24 — they each start at
    // local midnight — so one clock reading is true for the whole column.
    const day = days[Math.min(days.length - 1, Math.floor(i / 24))]
    const order = cities
      .map((_, ci) => ci)
      .sort((a, b) => cities[b].hourlyTemp[i] - cities[a].hourlyTemp[i])
    setHover({
      i,
      c,
      x: e.clientX,
      y: e.clientY,
      title: `${weekday(day)} ${String(i % 24).padStart(2, '0')}:00 local`,
      active: order.indexOf(c),
      rows: order.map((ci) => ({
        color: colors[ci],
        label: cities[ci].name,
        value: `${cities[ci].hourlyTemp[i].toFixed(1)}°`,
      })),
    })
  }

  // Only the crosshair moves with the pointer. Holding the rest as one element
  // lets React skip the subtree entirely on a hover — otherwise every grid
  // line, day rule and series path is rebuilt and reconciled on every move.
  const chrome = useMemo(() => {
    const gridValues = []
    for (let v = lo; v <= hi; v += step) gridValues.push(v)
    return (
      <>
        {gridValues.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="currentColor"
              strokeOpacity={0.06}
            />
            <text
              x={PAD.left - 6}
              y={y(v)}
              dy="0.3em"
              textAnchor="end"
              className="fill-ink/35 tabular-nums"
            >
              {v}°
            </text>
          </g>
        ))}
        {days.map((day, di) => (
          <g key={day}>
            {di > 0 && (
              <line
                x1={x(di * 24)}
                x2={x(di * 24)}
                y1={PAD.top}
                y2={HEIGHT - PAD.bottom}
                stroke="currentColor"
                strokeOpacity={0.04}
              />
            )}
            <text
              x={x(di * 24 + 12)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-ink/35 tabular-nums"
            >
              {weekday(day)}
            </text>
          </g>
        ))}
        {paths.map((d, i) => (
          <path
            key={cities[i].code}
            d={d}
            fill="none"
            stroke={colors[i]}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="transition-colors duration-300"
          />
        ))}
      </>
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities, days, colors, paths, lo, hi, step, WIDTH])

  // Direct-label only the extremes at the right edge; the masthead is the legend
  const edgeLabels = useMemo(() => {
    const last = cities.map((c) => c.hourlyTemp[c.hourlyTemp.length - 1])
    const labeled = [...new Set([last.indexOf(Math.max(...last)), last.indexOf(Math.min(...last))])]
    return (
      <>
        {labeled.map((i) => (
          <text
            key={cities[i].code}
            x={WIDTH - PAD.right + 5}
            y={y(last[i])}
            dy="0.3em"
            className="fill-ink/55 tabular-nums"
          >
            {cities[i].code}
          </text>
        ))}
      </>
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities, lo, hi, WIDTH])

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="chart-svg block w-full cursor-crosshair text-ink"
        role="img"
        aria-label={`Hourly temperature for ${cities.map((c) => c.name).join(', ')}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onPointerCancel={() => setHover(null)}
      >
        {chrome}
        {hover && (
          <g pointerEvents="none">
            <line
              x1={x(hover.i)}
              x2={x(hover.i)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke="currentColor"
              strokeOpacity={0.2}
            />
            <circle
              cx={x(hover.i)}
              cy={y(cities[hover.c].hourlyTemp[hover.i])}
              r={4}
              fill={colors[hover.c]}
              className="stroke-panel"
              strokeWidth={1.5}
            />
          </g>
        )}
        {edgeLabels}
      </svg>
      {hover && <ChartTip {...hover} />}
    </>
  )
}

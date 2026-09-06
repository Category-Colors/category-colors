import { useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { CityWeather } from '@/lib/weather'
import { ChartTip, type Tip } from './ChartTip'
import { svgPoint, useChartUnit, useHoverState } from './chart-geometry'

const WIDTH = 540
const HEIGHT = 300
const PAD = { top: 10, right: 12, bottom: 26, left: 34 }
const DOT_R = 2.3
// Squared pick radius, in viewBox units: roughly a fingertip's worth of slop
// around a 2.3-unit dot without letting the cursor claim a dot it isn't near.
const HIT_R2 = 10 * 10

// One dot as a closed subpath, so a whole city's 168 hours becomes a single
// <path> instead of 168 <circle> nodes (20 cities × 168 = 3,360 elements that
// React would otherwise reconcile on every palette edit).
const dot = (cx: number, cy: number) =>
  `M${cx.toFixed(1)},${cy.toFixed(1)}m-${DOT_R},0a${DOT_R},${DOT_R} 0 1,0 ${DOT_R * 2},0a${DOT_R},${DOT_R} 0 1,0 -${DOT_R * 2},0`

export function ClimateScatter({
  cities,
  colors,
}: {
  cities: CityWeather[]
  colors: string[]
}) {
  const temps = cities.flatMap((c) => c.hourlyTemp)
  const hums = cities.flatMap((c) => c.hourlyHumidity)
  const rawXLo = Math.floor(Math.min(...temps) / 5) * 5
  const rawXHi = Math.ceil(Math.max(...temps) / 5) * 5
  const xLo = rawXLo === rawXHi ? rawXLo - 5 : rawXLo
  const xHi = rawXLo === rawXHi ? rawXHi + 5 : rawXHi
  const rawYLo = Math.max(0, Math.floor(Math.min(...hums) / 10) * 10)
  const yLo = rawYLo >= 100 ? 90 : rawYLo
  const yHi = 100
  const xStep = xHi - xLo > 25 ? 10 : 5

  const plotW = WIDTH - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const x = (t: number) => PAD.left + ((t - xLo) / (xHi - xLo)) * plotW
  const y = (h: number) => PAD.top + plotH * (1 - (h - yLo) / (yHi - yLo))

  const svgRef = useRef<SVGSVGElement>(null)
  useChartUnit(svgRef, WIDTH)

  // Keep the plotted positions, not just the path strings: hover has to find
  // the nearest dot, and re-projecting 3,360 points per pointermove would be
  // the same work done over and over.
  const { paths, pts } = useMemo(() => {
    const pts = cities.map((city) =>
      city.hourlyTemp.map((t, h) => [x(t), y(city.hourlyHumidity[h])] as const)
    )
    return { pts, paths: pts.map((p) => p.map(([cx, cy]) => dot(cx, cy)).join('')) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities, xLo, xHi, yLo])

  const [hover, setHover] = useHoverState<Tip & { c: number; h: number }>(cities)
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const { vx, vy } = svgPoint(e, WIDTH, HEIGHT)
    let best = HIT_R2
    let c = -1
    let h = -1
    pts.forEach((p, ci) => {
      p.forEach(([dotX, dotY], hi) => {
        const d = (dotX - vx) ** 2 + (dotY - vy) ** 2
        if (d < best) {
          best = d
          c = ci
          h = hi
        }
      })
    })
    if (c < 0) {
      setHover(null)
      return
    }
    setHover({
      c,
      h,
      x: e.clientX,
      y: e.clientY,
      rows: [
        {
          color: colors[c],
          label: cities[c].name,
          value: `${cities[c].hourlyTemp[h].toFixed(1)}° · ${Math.round(cities[c].hourlyHumidity[h])}% RH`,
        },
      ],
    })
  }

  // Only the hover ring moves with the pointer; 3,360 dots and both axes are
  // rebuilt once per palette, not once per move.
  const chrome = useMemo(() => {
    const xTicks = []
    for (let v = xLo; v <= xHi; v += xStep) xTicks.push(v)
    const yTicks = []
    for (let v = yLo; v <= yHi; v += 20) yTicks.push(v)
    return (
      <>
        {yTicks.map((v) => (
          <g key={`y${v}`}>
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
              {v}%
            </text>
          </g>
        ))}
        {xTicks.map((v) => (
          <text
            key={`x${v}`}
            x={x(v)}
            y={HEIGHT - 8}
            textAnchor="middle"
            className="fill-ink/35 tabular-nums"
          >
            {v}°
          </text>
        ))}
        {paths.map((d, i) => (
          <path
            key={cities[i].code}
            d={d}
            fill={colors[i]}
            fillOpacity={0.65}
            className="transition-colors duration-300"
          />
        ))}
      </>
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths, cities, colors, xLo, xHi, yLo, xStep])

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="chart-svg block w-full cursor-crosshair text-ink"
        style={{ '--dot-r': DOT_R } as CSSProperties}
        role="img"
        aria-label={`Hourly temperature against relative humidity for ${cities.map((c) => c.name).join(', ')}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onPointerCancel={() => setHover(null)}
      >
        {chrome}
        {/* A hairline ring sitting 1px clear of the dot's edge. The stroke
            straddles the radius, so half of it is added back to keep that
            gap honest at any chart width. */}
        {hover && (
          <circle
            cx={pts[hover.c][hover.h][0]}
            cy={pts[hover.c][hover.h][1]}
            className="chart-hover-ring"
            fill="none"
            stroke={colors[hover.c]}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )}
      </svg>
      {hover && <ChartTip {...hover} />}
    </>
  )
}

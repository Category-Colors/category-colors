import { useMemo } from 'react'
import type { CityWeather } from '@/lib/weather'

const WIDTH = 540
const HEIGHT = 300
const PAD = { top: 10, right: 12, bottom: 26, left: 34 }
const DOT_R = 2.3

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
  const xLo = Math.floor(Math.min(...temps) / 5) * 5
  const xHi = Math.ceil(Math.max(...temps) / 5) * 5
  const yLo = Math.max(0, Math.floor(Math.min(...hums) / 10) * 10)
  const yHi = 100
  const xStep = xHi - xLo > 25 ? 10 : 5

  const plotW = WIDTH - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const x = (t: number) => PAD.left + ((t - xLo) / (xHi - xLo)) * plotW
  const y = (h: number) => PAD.top + plotH * (1 - (h - yLo) / (yHi - yLo))

  const xTicks = []
  for (let v = xLo; v <= xHi; v += xStep) xTicks.push(v)
  const yTicks = []
  for (let v = yLo; v <= yHi; v += 20) yTicks.push(v)

  const paths = useMemo(
    () =>
      cities.map((city) =>
        city.hourlyTemp.map((t, h) => dot(x(t), y(city.hourlyHumidity[h]))).join('')
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cities, xLo, xHi, yLo]
  )

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block w-full text-ink">
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
            y={y(v) + 3}
            textAnchor="end"
            className="fill-ink/35 tabular-nums text-[10px]"
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
          className="fill-ink/35 tabular-nums text-[10px]"
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
        >
          <title>{cities[i].name}</title>
        </path>
      ))}
    </svg>
  )
}

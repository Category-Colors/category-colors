import { useMemo } from 'react'
import type { CityWeather } from '@/lib/weather'

const WIDTH = 1120
const HEIGHT = 300
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

  const paths = useMemo(
    () =>
      cities.map((city) =>
        city.hourlyTemp
          .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
          .join(' ')
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cities, lo, hi]
  )

  const gridValues = []
  for (let v = lo; v <= hi; v += step) gridValues.push(v)

  // Direct-label only the extremes at the right edge; the masthead is the legend
  const last = cities.map((c) => c.hourlyTemp[c.hourlyTemp.length - 1])
  const labeled = [...new Set([last.indexOf(Math.max(...last)), last.indexOf(Math.min(...last))])]

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block w-full text-ink">
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
            y={y(v) + 3}
            textAnchor="end"
            className="fill-ink/35 tabular-nums text-[10px]"
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
            className="fill-ink/35 tabular-nums text-[10px]"
          >
            {new Date(`${day}T12:00`).toLocaleDateString(undefined, { weekday: 'short' })}
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
        >
          <title>{cities[i].name}</title>
        </path>
      ))}
      {labeled.map((i) => (
        <text
          key={cities[i].code}
          x={WIDTH - PAD.right + 5}
          y={y(last[i]) + 3}
          className="fill-ink/55 tabular-nums text-[10px]"
        >
          {cities[i].code}
        </text>
      ))}
    </svg>
  )
}

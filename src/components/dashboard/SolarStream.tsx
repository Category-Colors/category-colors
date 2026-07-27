import { useMemo } from 'react'
import type { CityWeather } from '@/lib/weather'

const WIDTH = 1120
const HEIGHT = 240
const PAD = { top: 10, right: 10, bottom: 26, left: 10 }

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
  const m = Math.min(...lead.map((l) => 168 - l))

  const { paths, dayTicks } = useMemo(() => {
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

    const paths = stacked.map(({ y0, y1 }) => {
      let d = ''
      for (let j = 0; j < m; j++) d += `${j ? 'L' : 'M'}${x(j).toFixed(1)},${Y(y1[j]).toFixed(1)}`
      for (let j = m - 1; j >= 0; j--) d += `L${x(j).toFixed(1)},${Y(y0[j]).toFixed(1)}`
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
        label: new Date(t).toLocaleDateString(undefined, {
          weekday: 'short',
          timeZone: 'UTC',
        }),
      })
    }

    return { paths, dayTicks }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities])

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block w-full text-ink">
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
            className="fill-ink/35 tabular-nums text-[10px]"
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
        >
          <title>{cities[i].name}</title>
        </path>
      ))}
    </svg>
  )
}

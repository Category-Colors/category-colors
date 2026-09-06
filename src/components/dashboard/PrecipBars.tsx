import { useState } from 'react'
import type { CityWeather } from '@/lib/weather'
import { ChartTip, type Tip } from './ChartTip'
import { tipAt } from './chart-geometry'
import { CityBadge } from './CityBadge'

const HEIGHT = 190
const TOP = 14

export function PrecipBars({ cities, colors }: { cities: CityWeather[]; colors: string[] }) {
  const max = Math.max(1, ...cities.map((c) => c.precipTotal))
  const gridValues = [0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f))
  const [tip, setTip] = useState<Tip | null>(null)

  return (
    <div className="flex flex-col gap-2">
      <div className="relative" style={{ height: HEIGHT }}>
        {gridValues.map((v) => {
          const y = TOP + (HEIGHT - TOP) * (1 - v / max)
          return (
            <div
              key={v}
              className="absolute inset-x-0 border-t border-ink/[0.06]"
              style={{ top: y }}
            >
              <span className="absolute -top-2 right-0 tabular-nums text-[10px] text-ink/35">
                {v}mm
              </span>
            </div>
          )
        })}
        <div
          className="absolute inset-x-0 bottom-0 flex items-end gap-[2px]"
          style={{ top: TOP }}
          onPointerLeave={() => setTip(null)}
        >
          {cities.map((city, i) => (
            // The hit target is the full-height column, not the bar: a dry
            // city's bar is a few pixels tall and would be unhoverable.
            <div
              key={city.code}
              className="flex h-full flex-1 items-end justify-center"
              onPointerMove={(e) => setTip(tipAt(e, colors[i], city.name, `${city.precipTotal.toFixed(1)} mm over 7 days`))}
            >
              <div
                className="w-full max-w-10 rounded-t-[4px] transition-colors duration-300"
                style={{
                  height: `${(city.precipTotal / max) * 100}%`,
                  backgroundColor: colors[i],
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-[2px]">
        {cities.map((city, i) => (
          <div key={city.code} className="flex flex-1 justify-center">
            <CityBadge code={city.code} color={colors[i]} size={15} />
          </div>
        ))}
      </div>
      {tip && <ChartTip {...tip} />}
    </div>
  )
}

import type { CityWeather } from '@/lib/weather'
import { CityBadge } from './CityBadge'

const HEIGHT = 190
const TOP = 14

export function PrecipBars({ cities, colors }: { cities: CityWeather[]; colors: string[] }) {
  const max = Math.max(1, ...cities.map((c) => c.precipTotal))
  const gridValues = [0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f))

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
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-[2px]" style={{ top: TOP }}>
          {cities.map((city, i) => (
            <div key={city.code} className="flex h-full flex-1 items-end justify-center">
              <div
                className="w-full max-w-10 rounded-t-[4px] transition-colors duration-300"
                style={{
                  height: `${(city.precipTotal / max) * 100}%`,
                  backgroundColor: colors[i],
                }}
                title={`${city.name} — ${city.precipTotal.toFixed(1)} mm over 7 days`}
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
    </div>
  )
}

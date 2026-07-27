import type { CityWeather } from '@/lib/weather'
import { CityBadge } from './CityBadge'

export function SunShare({ cities, colors }: { cities: CityWeather[]; colors: string[] }) {
  const hours = cities.map((c) => c.sunshineDaily.reduce((sum, h) => sum + h, 0))
  // a forecast with no sun anywhere would divide by zero; the fallback keeps
  // every share at 0% (an empty bar) instead of NaN
  const total = hours.reduce((sum, h) => sum + h, 0) || 1

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-7 gap-[2px] overflow-hidden rounded-md">
        {cities.map((city, i) => (
          <div
            key={city.code}
            className="transition-colors duration-300"
            style={{
              width: `${(hours[i] / total) * 100}%`,
              backgroundColor: colors[i],
            }}
            title={`${city.name} — ${Math.round(hours[i])}h of sun over 7 days`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {cities.map((city, i) => (
          <span key={city.code} className="flex items-center gap-1.5">
            <CityBadge code={city.code} color={colors[i]} size={15} />
            <span className="tabular-nums text-[11px] text-ink/50">{Math.round(hours[i])}h</span>
          </span>
        ))}
      </div>
    </div>
  )
}

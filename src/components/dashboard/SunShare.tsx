import { useState } from 'react'
import type { CityWeather } from '@/lib/weather'
import { ChartTip, type Tip } from './ChartTip'
import { tipAt } from './chart-geometry'
import { CityBadge } from './CityBadge'

export function SunShare({ cities, colors }: { cities: CityWeather[]; colors: string[] }) {
  const hours = cities.map((c) => c.sunshineDaily.reduce((sum, h) => sum + h, 0))
  // a forecast with no sun anywhere would divide by zero; the fallback keeps
  // every share at 0% (an empty bar) instead of NaN
  const total = hours.reduce((sum, h) => sum + h, 0) || 1
  const [tip, setTip] = useState<Tip | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex h-7 gap-[2px] overflow-hidden rounded-md"
        onPointerLeave={() => setTip(null)}
      >
        {cities.map((city, i) => (
          <div
            key={city.code}
            className="transition-colors duration-300"
            style={{
              width: `${(hours[i] / total) * 100}%`,
              backgroundColor: colors[i],
            }}
            onPointerMove={(e) => setTip(tipAt(e, colors[i], city.name, `${Math.round(hours[i])}h of sun · ${Math.round((hours[i] / total) * 100)}%`))}
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
      {tip && <ChartTip {...tip} />}
    </div>
  )
}

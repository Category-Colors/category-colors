import type { CityWeather } from '@/lib/weather'

const HEIGHT = 190
const TOP = 14

const weekday = (day: string) =>
  new Date(`${day}T12:00`).toLocaleDateString(undefined, { weekday: 'short' })

export function SunshineBars({
  cities,
  days,
  colors,
}: {
  cities: CityWeather[]
  days: string[]
  colors: string[]
}) {
  const max = Math.max(1, ...cities.flatMap((c) => c.sunshineDaily))
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
                {v}h
              </span>
            </div>
          )
        })}
        <div className="absolute inset-x-0 bottom-0 flex gap-3" style={{ top: TOP }}>
          {days.map((day, d) => (
            <div key={day} className="flex h-full flex-1 items-end justify-center gap-[2px]">
              {cities.map((city, i) => (
                <div
                  key={city.code}
                  className="max-w-3 flex-1 rounded-t-[3px] transition-colors duration-300"
                  style={{
                    height: `${(city.sunshineDaily[d] / max) * 100}%`,
                    backgroundColor: colors[i],
                  }}
                  title={`${city.name} — ${city.sunshineDaily[d].toFixed(1)}h of sun ${weekday(day)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        {days.map((day) => (
          <span key={day} className="flex-1 text-center tabular-nums text-[10px] text-ink/35">
            {weekday(day)}
          </span>
        ))}
      </div>
    </div>
  )
}

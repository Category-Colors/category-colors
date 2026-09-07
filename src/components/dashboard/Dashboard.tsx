import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchWeather, type WeatherData } from '@/lib/weather'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { TempLines } from './TempLines'
import { SolarStream } from './SolarStream'
import { SunshineBars } from './SunshineBars'
import { ClimateScatter } from './ClimateScatter'
import { PrecipBars } from './PrecipBars'
import { SunShare } from './SunShare'
import {
  ClimateScatterSkeleton,
  PrecipBarsSkeleton,
  SolarStreamSkeleton,
  SunShareSkeleton,
  SunshineBarsSkeleton,
  TempLinesSkeleton,
} from './ChartSkeletons'

// The titles and descriptions are fixed copy, not derived from the response,
// so a loading card is the finished card with a placeholder where its marks
// go — no spinner state to lay out and nothing that moves when data lands.
function ChartCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card className="bg-ink/[0.03] ring-ink/[0.06]">
      <CardHeader>
        <CardTitle className="text-ink/85">{title}</CardTitle>
        <CardDescription className="text-ink/40">{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function Dashboard({ colors }: { colors: string[] }) {
  const [data, setData] = useState<WeatherData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setError(null)
    fetchWeather()
      .then((next) => {
        if (active) setData(next)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      active = false
    }
  }, [attempt])

  // Preserve the city-array identity while colors change but their count does
  // not, so chart path memoization survives live palette edits.
  const cities = useMemo(
    () => data?.cities.slice(0, colors.length) ?? [],
    [data, colors.length]
  )

  if (colors.length === 0) {
    return (
      <p className="pt-6 tabular-nums text-[12px] text-ink/50">
        The palette is empty — add a color in the Output panel or generate a new palette.
      </p>
    )
  }
  if (error) {
    return (
      <div className="pt-6 text-[12px] text-ink/70" role="alert">
        <p>Couldn't load the forecast ({error}). Your palette is still available.</p>
        <button type="button" className="mt-3 underline" onClick={() => setAttempt((value) => value + 1)}>
          Retry weather
        </button>
      </div>
    )
  }
  const n = colors.length

  return (
    <div className="flex flex-col gap-5" aria-busy={!data}>
      <p className="sr-only" role="status">
        {data ? 'Forecast loaded.' : 'Fetching live conditions…'}
      </p>

      <ChartCard title="Temperature, next 7 days" description="Hourly forecast, °C, local time">
        {data ? (
          <TempLines cities={cities} days={data.days} colors={colors} />
        ) : (
          <TempLinesSkeleton count={n} />
        )}
      </ChartCard>

      <ChartCard
        title="Sunlight around the globe"
        description="Shortwave radiation stacked by city, UTC — daylight rolling west"
      >
        {data ? (
          <SolarStream cities={cities} colors={colors} />
        ) : (
          <SolarStreamSkeleton count={n} />
        )}
      </ChartCard>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ChartCard title="Sunshine by day" description="Hours of sun per forecast day">
          {data ? (
            <SunshineBars cities={cities} days={data.days} colors={colors} />
          ) : (
            <SunshineBarsSkeleton count={n} />
          )}
        </ChartCard>

        <ChartCard
          title="Temperature vs humidity"
          description="One dot per forecast hour, °C against relative humidity"
        >
          {data ? (
            <ClimateScatter cities={cities} colors={colors} />
          ) : (
            <ClimateScatterSkeleton count={n} />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ChartCard title="Precipitation" description="Total over the 7-day forecast, mm">
          {data ? (
            <PrecipBars cities={cities} colors={colors} />
          ) : (
            <PrecipBarsSkeleton count={n} />
          )}
        </ChartCard>

        <ChartCard title="Share of sunshine" description="Hours of sun over the 7-day forecast">
          {data ? <SunShare cities={cities} colors={colors} /> : <SunShareSkeleton count={n} />}
        </ChartCard>
      </div>
      <p className="text-[12px] text-ink/70">
        Weather data by <a className="underline" href="https://open-meteo.com/">Open-Meteo</a>,
        {' '}<a className="underline" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
        {' '}Daily totals and sunshine hours calculated from forecast data.
        {colors.length > 20 && ' Preview shows the first 20 palette colors.'}
      </p>
    </div>
  )
}

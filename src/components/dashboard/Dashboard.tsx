import { useEffect, useMemo, useState } from 'react'
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

export function Dashboard({ colors }: { colors: string[] }) {
  const [data, setData] = useState<WeatherData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
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
  }, [])

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
      <p className="pt-6 tabular-nums text-[12px] text-ink/50">
        Couldn't reach Open-Meteo ({error}). Reload to retry.
      </p>
    )
  }
  if (!data) {
    return <p className="pt-6 tabular-nums text-[12px] text-ink/50">Fetching live conditions…</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="bg-ink/[0.03] ring-ink/[0.06]">
        <CardHeader>
          <CardTitle className="text-ink/85">Temperature, next 7 days</CardTitle>
          <CardDescription className="text-ink/40">
            Hourly forecast, °C, local time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TempLines cities={cities} days={data.days} colors={colors} />
        </CardContent>
      </Card>

      <Card className="bg-ink/[0.03] ring-ink/[0.06]">
        <CardHeader>
          <CardTitle className="text-ink/85">Sunlight around the globe</CardTitle>
          <CardDescription className="text-ink/40">
            Shortwave radiation stacked by city, UTC — daylight rolling west
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SolarStream cities={cities} colors={colors} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="bg-ink/[0.03] ring-ink/[0.06]">
          <CardHeader>
            <CardTitle className="text-ink/85">Sunshine by day</CardTitle>
            <CardDescription className="text-ink/40">
              Hours of sun per forecast day
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SunshineBars cities={cities} days={data.days} colors={colors} />
          </CardContent>
        </Card>

        <Card className="bg-ink/[0.03] ring-ink/[0.06]">
          <CardHeader>
            <CardTitle className="text-ink/85">Temperature vs humidity</CardTitle>
            <CardDescription className="text-ink/40">
              One dot per forecast hour, °C against relative humidity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ClimateScatter cities={cities} colors={colors} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="bg-ink/[0.03] ring-ink/[0.06]">
          <CardHeader>
            <CardTitle className="text-ink/85">Precipitation</CardTitle>
            <CardDescription className="text-ink/40">
              Total over the 7-day forecast, mm
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PrecipBars cities={cities} colors={colors} />
          </CardContent>
        </Card>

        <Card className="bg-ink/[0.03] ring-ink/[0.06]">
          <CardHeader>
            <CardTitle className="text-ink/85">Share of sunshine</CardTitle>
            <CardDescription className="text-ink/40">
              Hours of sun over the 7-day forecast
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SunShare cities={cities} colors={colors} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

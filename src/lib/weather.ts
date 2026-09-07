// Live data for the example dashboard: 7-day forecasts for 20 cities in one
// batched Open-Meteo request (no key required). Cached so palette edits and
// re-renders never refetch; the dashboard slices the list to the palette size.

import { wcagContrast } from 'culori'

import { CITIES, forecastParams } from './weather-cities'
export { CITIES, type City } from './weather-cities'

export interface CityWeather {
  code: string
  name: string
  startUtcMs: number // UTC instant of hourly index 0 (each city starts at its own local midnight)
  hourlyTemp: number[] // 168 hourly values, local time
  hourlyHumidity: number[] // %, aligned with hourlyTemp
  hourlyRadiation: number[] // shortwave W/m², aligned with hourlyTemp
  sunshineDaily: number[] // hours of sun per forecast day
  precipTotal: number // mm over the 7-day forecast
}

export interface WeatherData {
  days: string[] // 7 ISO dates (the calendar most cities are on — outliers differ by a day)
  cities: CityWeather[]
}

interface OpenMeteoResult {
  utc_offset_seconds: number
  hourly: {
    time: string[]
    temperature_2m: number[]
    relative_humidity_2m: number[]
    shortwave_radiation: number[]
  }
  daily: { time: string[]; precipitation_sum: number[]; sunshine_duration: number[] }
}

const finiteArray = (value: unknown, minLength: number): value is number[] =>
  Array.isArray(value) &&
  value.length >= minLength &&
  value.every((item) => typeof item === 'number' && Number.isFinite(item))

function isOpenMeteoResult(value: unknown): value is OpenMeteoResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<OpenMeteoResult>
  const hourly = result.hourly
  const daily = result.daily
  return (
    typeof result.utc_offset_seconds === 'number' &&
    Number.isFinite(result.utc_offset_seconds) &&
    !!hourly &&
    Array.isArray(hourly.time) &&
    typeof hourly.time[0] === 'string' &&
    finiteArray(hourly.temperature_2m, 2) &&
    finiteArray(hourly.relative_humidity_2m, 2) &&
    finiteArray(hourly.shortwave_radiation, 2) &&
    !!daily &&
    Array.isArray(daily.time) &&
    daily.time.length >= 7 &&
    daily.time.every((day) => typeof day === 'string') &&
    finiteArray(daily.precipitation_sum, 7) &&
    finiteArray(daily.sunshine_duration, 7)
  )
}

async function requestAll(): Promise<WeatherData> {
  // Local Vite development can use the public endpoint. Production always
  // goes through the fixed, cached Cloudflare endpoint; keys stay server-side.
  const url = import.meta.env.DEV ? `https://api.open-meteo.com/v1/forecast?${forecastParams()}` : '/api/weather'
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`)
  const json: unknown = await res.json()
  const results = Array.isArray(json) ? json : [json]
  if (results.length !== CITIES.length || !results.every(isOpenMeteoResult)) {
    throw new Error('Open-Meteo returned incomplete forecast data')
  }

  const cities = results.map((r, i) => {
    const hourlyLength = Math.min(
      r.hourly.temperature_2m.length,
      r.hourly.relative_humidity_2m.length,
      r.hourly.shortwave_radiation.length
    )
    const localStart = Date.parse(`${r.hourly.time[0]}:00Z`)
    if (!Number.isFinite(localStart)) throw new Error('Open-Meteo returned an invalid start time')
    return {
      code: CITIES[i].code,
      name: CITIES[i].name,
      startUtcMs: localStart - r.utc_offset_seconds * 1000,
      hourlyTemp: r.hourly.temperature_2m.slice(0, hourlyLength),
      hourlyHumidity: r.hourly.relative_humidity_2m.slice(0, hourlyLength),
      hourlyRadiation: r.hourly.shortwave_radiation.slice(0, hourlyLength),
      sunshineDaily: r.daily.sunshine_duration.slice(0, 7).map((s) => s / 3600),
      precipTotal: r.daily.precipitation_sum.slice(0, 7).reduce((sum, v) => sum + v, 0),
    }
  })
  const sharedStart = Math.max(...cities.map((city) => city.startUtcMs))
  const hasSharedWindow = cities.every((city) => {
    const lead = Math.round((sharedStart - city.startUtcMs) / 3_600_000)
    return city.hourlyRadiation.length - lead >= 2
  })
  if (!hasSharedWindow) throw new Error('Open-Meteo forecasts do not share an hourly window')

  // Cities straddle the date line, so "today" differs; label days by the
  // calendar most of them are on.
  const starts = results.map((r) => r.daily.time[0])
  const mode = [...new Set(starts)].sort(
    (a, b) => starts.filter((s) => s === b).length - starts.filter((s) => s === a).length
  )[0]
  return { days: results[starts.indexOf(mode)].daily.time.slice(0, 7), cities }
}

const CACHE_TTL_MS = 10 * 60 * 1000
let cache: { at: number; data: WeatherData } | null = null
let inflight: Promise<WeatherData> | null = null

export function fetchWeather(): Promise<WeatherData> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return Promise.resolve(cache.data)
  inflight ??= requestAll()
    .then((data) => {
      cache = { at: Date.now(), data }
      return data
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

// Perceived-luminance check for text set on a palette color; accepts any
// css color string (palette colors carry their own format)
export function inkFor(color: string): string {
  return wcagContrast(color, '#000') >= wcagContrast(color, '#fff') ? '#000000' : '#ffffff'
}

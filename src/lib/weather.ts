// Live data for the example dashboard: 7-day forecasts for 20 cities in one
// batched Open-Meteo request (no key required). Cached so palette edits and
// re-renders never refetch; the dashboard slices the list to the palette size.

import { converter } from 'culori'

const toRgbMode = converter('rgb')

export interface City {
  code: string
  name: string
  lat: number
  lon: number
}

// Ordered so any prefix spans climates (the dashboard shows the first N).
export const CITIES: City[] = [
  { code: 'TYO', name: 'Tokyo', lat: 35.68, lon: 139.69 },
  { code: 'LON', name: 'London', lat: 51.51, lon: -0.13 },
  { code: 'DXB', name: 'Dubai', lat: 25.2, lon: 55.27 },
  { code: 'SIN', name: 'Singapore', lat: 1.35, lon: 103.82 },
  { code: 'SYD', name: 'Sydney', lat: -33.87, lon: 151.21 },
  { code: 'RKV', name: 'Reykjavík', lat: 64.15, lon: -21.94 },
  { code: 'BOM', name: 'Mumbai', lat: 19.08, lon: 72.88 },
  { code: 'MEX', name: 'Mexico City', lat: 19.43, lon: -99.13 },
  { code: 'BER', name: 'Berlin', lat: 52.52, lon: 13.41 },
  { code: 'CAI', name: 'Cairo', lat: 30.04, lon: 31.24 },
  { code: 'NBO', name: 'Nairobi', lat: -1.29, lon: 36.82 },
  { code: 'BKK', name: 'Bangkok', lat: 13.76, lon: 100.5 },
  { code: 'SEL', name: 'Seoul', lat: 37.57, lon: 126.98 },
  { code: 'AKL', name: 'Auckland', lat: -36.85, lon: 174.76 },
  { code: 'HNL', name: 'Honolulu', lat: 21.31, lon: -157.86 },
  { code: 'ANC', name: 'Anchorage', lat: 61.22, lon: -149.9 },
  { code: 'YVR', name: 'Vancouver', lat: 49.28, lon: -123.12 },
  { code: 'BUE', name: 'Buenos Aires', lat: -34.6, lon: -58.38 },
  { code: 'MAD', name: 'Madrid', lat: 40.42, lon: -3.7 },
  { code: 'LOS', name: 'Lagos', lat: 6.52, lon: 3.38 },
]

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

async function requestAll(): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: CITIES.map((c) => c.lat).join(','),
    longitude: CITIES.map((c) => c.lon).join(','),
    hourly: 'temperature_2m,relative_humidity_2m,shortwave_radiation',
    daily: 'precipitation_sum,sunshine_duration',
    forecast_days: '7',
    timezone: 'auto',
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`)
  const json: OpenMeteoResult | OpenMeteoResult[] = await res.json()
  const results = Array.isArray(json) ? json : [json]

  const cities = results.map((r, i) => ({
    code: CITIES[i].code,
    name: CITIES[i].name,
    startUtcMs: Date.parse(`${r.hourly.time[0]}:00Z`) - r.utc_offset_seconds * 1000,
    hourlyTemp: r.hourly.temperature_2m,
    hourlyHumidity: r.hourly.relative_humidity_2m,
    hourlyRadiation: r.hourly.shortwave_radiation,
    sunshineDaily: r.daily.sunshine_duration.map((s) => (s ?? 0) / 3600),
    precipTotal: r.daily.precipitation_sum.reduce((sum, v) => sum + (v ?? 0), 0),
  }))

  // Cities straddle the date line, so "today" differs; label days by the
  // calendar most of them are on.
  const starts = results.map((r) => r.daily.time[0])
  const mode = [...new Set(starts)].sort(
    (a, b) => starts.filter((s) => s === b).length - starts.filter((s) => s === a).length
  )[0]
  return { days: results[starts.indexOf(mode)].daily.time, cities }
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
  const c = toRgbMode(color)
  if (!c) return 'rgba(255,255,255,0.94)'
  const luminance = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b
  return luminance > 0.55 ? 'rgba(0,0,0,0.82)' : 'rgba(255,255,255,0.94)'
}

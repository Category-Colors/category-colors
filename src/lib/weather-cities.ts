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

export function forecastParams(): URLSearchParams {
  return new URLSearchParams({
    latitude: CITIES.map((c) => c.lat).join(','),
    longitude: CITIES.map((c) => c.lon).join(','),
    hourly: 'temperature_2m,relative_humidity_2m,shortwave_radiation',
    daily: 'precipitation_sum,sunshine_duration',
    forecast_days: '7',
    timezone: 'auto',
  })
}

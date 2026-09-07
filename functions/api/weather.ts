import { forecastParams } from '../../src/lib/weather-cities'

interface Env { OPEN_METEO_API_KEY?: string; WEATHER_NON_COMMERCIAL?: string }
interface Context { request: Request; env: Env; waitUntil: (task: Promise<unknown>) => void }

const failure = (message: string, status: number) => Response.json({ error: message }, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
})

export async function onRequest({ request, env, waitUntil }: Context): Promise<Response> {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } })
  if (!env.OPEN_METEO_API_KEY && env.WEATHER_NON_COMMERCIAL !== 'true') {
    return failure('Live forecasts are not configured yet.', 503)
  }
  // No caller-provided coordinates, URLs, or query parameters reach upstream.
  // All visitors share the same bounded forecast and cache entry.
  const key = new Request(new URL('/api/weather-cache-v1', request.url))
  const cache = await caches.open('category-colors-weather-v1')
  const hit = await cache.match(key)
  if (hit) return hit
  const params = forecastParams()
  if (env.OPEN_METEO_API_KEY) params.set('apikey', env.OPEN_METEO_API_KEY)
  const host = env.OPEN_METEO_API_KEY ? 'customer-api.open-meteo.com' : 'api.open-meteo.com'
  try {
    const response = await fetch(`https://${host}/v1/forecast?${params}`, { signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return failure('The forecast provider is temporarily unavailable.', 502)
    const body: unknown = await response.json()
    if (!Array.isArray(body) || body.length !== 20) return failure('The forecast provider returned incomplete data.', 502)
    const result = Response.json(body, { headers: {
      'Cache-Control': 'public, max-age=600',
      'X-Content-Type-Options': 'nosniff',
    } })
    waitUntil(cache.put(key, result.clone()).catch(() => undefined))
    return result
  } catch {
    // Never reflect an upstream URL or exception: it may contain the API key.
    return failure('The forecast provider could not be reached. Please retry.', 502)
  }
}

import { WorkerEntrypoint } from 'cloudflare:workers'

// Called by the site's /mcp function: env.LIMITS.allow('request' | 'generate', ip)
export default class Limits extends WorkerEntrypoint {
  async allow(action, key) {
    const { env } = this
    if (action === 'request') return (await env.REQUESTS.limit({ key })).success
    if (action === 'generate') {
      return (await env.GENERATIONS.limit({ key })).success && (await env.ALL_GENERATIONS.limit({ key: 'all' })).success
    }
    throw new Error(`Unknown action: ${action}`)
  }

  fetch() {
    return new Response('Not found', { status: 404 })
  }
}

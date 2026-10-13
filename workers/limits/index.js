import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers'

// Called by the site's /mcp function: env.LIMITS.allow('request' | 'generate', ip).
// Each action is a list of [counter, limit per minute, key]; a call is allowed
// only while every counter is under its limit.
const POLICY = {
  // Every /mcp request, per client IP
  request: (ip) => [['request', 60, ip]],
  // Palette generations (2–13 s of CPU each), per client IP and from everyone;
  // the second caps the CPU bill
  generate: (ip) => [['generate', 5, ip], ['generate', 10, 'all']],
}

export default class Limits extends WorkerEntrypoint {
  async allow(action, ip) {
    const counters = POLICY[action]?.(ip)
    if (!counters) throw new Error(`Unknown action: ${action}`)
    for (const [name, limit, key] of counters) {
      const counter = this.env.COUNTERS.get(this.env.COUNTERS.idFromName(`${name}:${key}`))
      if (!(await counter.hit(limit))) return false
    }
    return true
  }

  fetch() {
    return new Response('Not found', { status: 404 })
  }
}

// One per counter and key, so its count is exact: Cloudflare's rate limiting
// binding counts per machine and, as of 2026-10-13, let 76 calls through a
// limit of 60. Counts live in memory; an evicted counter starts over, which
// only happens after it has sat idle.
export class Counter extends DurableObject {
  start = 0
  count = 0

  hit(limit) {
    const now = Date.now()
    if (now - this.start >= 60_000) {
      this.start = now
      this.count = 0
    }
    return ++this.count <= limit
  }
}

import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers'

// Called by the site's /mcp function: env.LIMITS.allow('request' | 'generate', ip)
// resolves to { allowed, remaining } or, refused, { allowed, retryAfter, limit,
// scope }. Each action is a list of [counter, limit per minute, key, scope]; a
// call is allowed only while every counter is under its limit. remaining is
// the fewest calls left on any counter this minute; retryAfter is the seconds
// until the refusing counter resets, and limit and scope name it.
const POLICY = {
  // Every /mcp request, per client IP
  request: (ip) => [['request', 60, ip, 'client']],
  // Palette generations, per client IP and from everyone; the second caps the
  // CPU bill. Measured in production on 2026-10-15: about 1 s of CPU for a
  // generation, 3 s for a fix, 6 s for the worst fix (20 crowded colors at
  // Strength 1), so 60 a minute is at most 6 CPU-minutes a minute.
  generate: (ip) => [['generate', 20, ip, 'client'], ['generate', 60, 'all', 'everyone']],
}

export default class Limits extends WorkerEntrypoint {
  async allow(action, ip) {
    const counters = POLICY[action]?.(ip)
    if (!counters) throw new Error(`Unknown action: ${action}`)
    let remaining = Infinity
    for (const [name, limit, key, scope] of counters) {
      const counter = this.env.COUNTERS.get(this.env.COUNTERS.idFromName(`${name}:${key}`))
      const hit = await counter.hit(limit)
      if (!hit.allowed) return { allowed: false, retryAfter: hit.retryAfter, limit, scope }
      remaining = Math.min(remaining, limit - hit.count)
    }
    return { allowed: true, remaining }
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
    this.count += 1
    if (this.count <= limit) return { allowed: true, count: this.count }
    return { allowed: false, retryAfter: Math.ceil((this.start + 60_000 - now) / 1000) }
  }
}

import { McpServer, createMcpHandler, fromJsonSchema, originValidationResponse } from '@modelcontextprotocol/server'
import { generatePalette } from '../src/lib/algorithm'
import { EXPORT_FORMATS, formatPalette } from '../src/lib/exporters'
import { DEFAULT_PARAMS } from '../src/lib/palette'
import { PRESET_PALETTES } from '../src/lib/presets'
import { GENERATE_INPUT, PRESET_NAMES, colorList, generateParams, readColors, readSeed, scratch, summarize } from '../src/lib/tools'

// The remote MCP server (docs/mcp-server-plan.md): the WebMCP tools without
// the page, so every call stands alone and takes its colors as input. It
// speaks both the 2026-07-28 revision and 2025-era clients that still send
// `initialize`; the SDK owns the protocol.
//
// Open to anyone, without auth. Rate limits keep that affordable: they live in
// workers/limits, counting requests and generations per client IP and
// generations from everyone (a generation costs 2–4 s of CPU in production,
// which only Workers Paid allows). Local runs without that Worker go unlimited. To take
// the endpoint down, set MCP_ENABLED to anything but "true" in wrangler.jsonc
// and deploy.

interface Limits { allow(action: 'request' | 'generate', key: string): Promise<boolean> }
interface Env { MCP_ENABLED?: string; LIMITS?: Limits }
interface Context { request: Request; env: Env }

// Browsers may only call from the site itself; CLI and desktop clients send no Origin
const ALLOWED_ORIGINS = ['categorycolors.com', 'localhost', '127.0.0.1']
// A generation costs 2–4 s of CPU and the per-client limit is 5 a minute
const MAX_RUNS = 3

const ok = (result: object) => ({ content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result as Record<string, unknown> })
const object = (properties: object, required: string[] = []) =>
  fromJsonSchema<Record<string, unknown>>({ type: 'object', properties, required, additionalProperties: false } as never)

// What summarize() returns, so clients get structuredContent they can read
// without parsing the text copy. Loose on purpose: it describes, it doesn't gate.
const swatchSchema = { type: 'object', properties: { css: { type: 'string' }, hex: { type: 'string' }, oklch: { type: 'string' } }, required: ['css'] }
const pairSchema = {
  type: 'object',
  properties: {
    colors: { type: 'array', items: { type: 'string' } },
    positions: { type: 'array', items: { type: 'integer' }, description: '1-based indexes into colors.' },
    deltaE: { type: 'number' },
  },
}
const PALETTE_OUTPUT = {
  colors: { type: 'array', items: swatchSchema },
  report: {
    type: 'object',
    properties: {
      jndThreshold: { type: 'number' },
      minDeltaE: { type: 'number', description: 'The closest pair under any condition. Higher is better.' },
      totalIssues: { type: 'integer' },
      tests: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            vision: { type: 'string' },
            minDeltaE: { type: 'number' },
            issueCount: { type: 'integer' },
            closePairs: { type: 'array', items: pairSchema, description: 'Pairs below the threshold, closest first, at most 10.' },
          },
        },
      },
    },
  },
  config: { type: 'object', description: 'The settings used, in the shape generate_palette\'s config takes.' },
  cost: { type: 'number', description: 'The optimizer\'s final cost; lower is better. Generated palettes only.' },
  seed: { type: 'integer', description: 'The seed this palette was made with; pass it back with the same config to make it again. Generated palettes only.' },
  link: { type: 'string', description: 'Opens the palette, with these settings, in the app.' },
}
const paletteOutput = (extra: object = {}) => object({ ...PALETTE_OUTPUT, ...extra }, ['colors', 'report', 'config', 'link'])
// A bad argument is the agent's to fix, so it comes back as a result it can read
const tool = (run: (input: Record<string, unknown>) => Promise<object> | object) => async (input: Record<string, unknown>) => {
  try {
    return ok(await run(input))
  } catch (err) {
    return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true }
  }
}

function server(allowGeneration: () => Promise<boolean>) {
  const mcp = new McpServer({ name: 'category-colors', title: 'Category Colors', version: '1.0.0' }, { maxToolInputElements: 200 })
  mcp.registerTool('generate_palette', {
    title: 'Generate palette',
    description: 'Optimizes a new categorical color palette (for chart series, map categories, tags) with simulated annealing, maximizing perceptual distance between colors, including under color vision deficiency. Takes the full configuration as `config` (the shape the app\'s Configure panel imports), or the shortcuts, over the defaults; echoes the settings used as `config` and the random `seed`, which with the same config reproduces the result. Returns each color as CSS, hex and OKLCH, an accessibility report, and a link that opens the palette in the Category Colors app. Takes a second or two per run.',
    inputSchema: object({
      ...GENERATE_INPUT,
      runs: { type: 'integer', minimum: 1, maximum: MAX_RUNS, description: `Run up to ${MAX_RUNS} times (seed, seed+1, …) and return the lowest-cost palette with its seed. Each run counts toward the rate limit.` },
    }),
    outputSchema: paletteOutput({ runs: { type: 'integer', description: 'How many runs were made; fewer than asked when the rate limit cut in.' } }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, tool(async (input) => {
    const params = generateParams(input, DEFAULT_PARAMS)
    const seed = readSeed(input.seed) ?? Math.floor(Math.random() * 2 ** 31)
    const wanted = typeof input.runs === 'number' ? Math.min(MAX_RUNS, Math.max(1, Math.round(input.runs))) : 1
    let best: ReturnType<typeof generatePalette> | null = null
    let runs = 0
    // Past the limit, the runs already made are still worth returning
    while (runs < wanted && (await allowGeneration())) {
      const result = generatePalette(params, seed + runs)
      if (!best || result.cost < best.cost) best = result
      runs += 1
    }
    if (!best) throw new Error('Too many palettes generated in the last minute. Wait a minute and try again.')
    return { runs, ...(await summarize({ id: 1, params, ...best, createdAt: Date.now() })) }
  }))
  mcp.registerTool('check_palette', {
    title: 'Check palette',
    description: 'Checks whether every pair of colors stays distinguishable under normal vision and simulated protanomaly, deuteranomaly, tritanomaly and grayscale, flagging pairs whose CIEDE2000 distance falls below the threshold. The report\'s minDeltaE is the closest pair under any condition, a score for comparing candidates. Returns the report, the settings used, and a link that opens the palette in the Category Colors app.',
    inputSchema: object({
      colors: colorList('The palette to check, in order.', 2),
      jnd: GENERATE_INPUT.jnd,
    }, ['colors']),
    outputSchema: paletteOutput(),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, tool(async (input) => {
    const params = generateParams({ jnd: input.jnd }, DEFAULT_PARAMS)
    return summarize(scratch(readColors(input.colors, 2), params))
  }))
  mcp.registerTool('get_preset_palette', {
    title: 'Get preset palette',
    description: 'Returns a well-known categorical palette (Okabe–Ito, Tableau 10, ColorBrewer and others) with its accessibility report, to compare against or start from.',
    inputSchema: object({ name: { type: 'string', enum: PRESET_NAMES } }, ['name']),
    outputSchema: paletteOutput({ name: { type: 'string' } }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, tool(async (input) => {
    const preset = PRESET_PALETTES.find((p) => p.name === input.name)
    if (!preset) throw new Error(`name must be one of ${PRESET_NAMES.join(', ')}.`)
    return { name: preset.name, ...(await summarize(scratch([...preset.colors], DEFAULT_PARAMS))) }
  }))
  mcp.registerTool('export_palette', {
    title: 'Export palette',
    description: 'Formats colors as text: raw (one color per line), css (custom properties) or json (W3C design tokens).',
    inputSchema: object({
      colors: colorList('The palette to export, in order.', 1),
      format: { type: 'string', enum: EXPORT_FORMATS.map((f) => f.value) },
    }, ['colors', 'format']),
    outputSchema: object({ format: { type: 'string' }, text: { type: 'string' } }, ['format', 'text']),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, tool((input) => {
    const format = EXPORT_FORMATS.find((f) => f.value === input.format)?.value
    if (!format) throw new Error(`format must be one of ${EXPORT_FORMATS.map((f) => f.value).join(', ')}.`)
    return { format, text: formatPalette(readColors(input.colors, 1), format) }
  }))
  return mcp
}

export async function onRequest({ request, env }: Context): Promise<Response> {
  if (env.MCP_ENABLED !== 'true') return new Response('Not found', { status: 404 })
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (env.LIMITS && !(await env.LIMITS.allow('request', ip))) {
    return new Response('Too many requests', { status: 429, headers: { 'Retry-After': '60' } })
  }
  const allowGeneration = async () => !env.LIMITS || env.LIMITS.allow('generate', ip)
  return originValidationResponse(request, ALLOWED_ORIGINS) ?? createMcpHandler(() => server(allowGeneration)).fetch(request)
}

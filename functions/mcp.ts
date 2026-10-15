import { McpServer, createMcpHandler, fromJsonSchema, originValidationResponse } from '@modelcontextprotocol/server'
import { generatePalette } from '../src/lib/algorithm'
import { EXPORT_FORMATS, formatPalette } from '../src/lib/exporters'
import { DEFAULT_PARAMS } from '../src/lib/palette'
import { PRESET_PALETTES } from '../src/lib/presets'
import { CONTRAST_INPUT, FIX_DESCRIPTION, FIX_INPUT, GENERATE_INPUT, PRESET_NAMES, colorList, fixParams, generateParams, readColors, readSeed, report, scratch, summarize, withContrast } from '../src/lib/tools'

// The remote MCP server (docs/mcp-server-plan.md): the WebMCP tools without
// the page, so every call stands alone and takes its colors as input. It
// speaks both the 2026-07-28 revision and 2025-era clients that still send
// `initialize`; the SDK owns the protocol.
//
// Open to anyone, without auth. Rate limits keep that affordable: they live in
// workers/limits, counting requests and generations per client IP and
// generations from everyone (in production a generation costs about 1 s of
// CPU and a fix 3-6 s, which only Workers Paid allows). Local runs without that Worker go unlimited. To take
// the endpoint down, set MCP_ENABLED to anything but "true" in wrangler.jsonc
// and deploy.

interface Verdict { allowed: boolean; remaining?: number; retryAfter?: number; limit?: number; scope?: 'client' | 'everyone' }
// A limits Worker from before 2026-10-15 answers with a bare boolean; read
// both, so the site and the Worker can deploy in either order
interface Limits { allow(action: 'request' | 'generate', key: string): Promise<Verdict | boolean> }
const ask = async (limits: Limits | undefined, action: 'request' | 'generate', key: string): Promise<Verdict> => {
  if (!limits) return { allowed: true }
  const answer = await limits.allow(action, key)
  return typeof answer === 'boolean' ? { allowed: answer } : answer
}
interface Env { MCP_ENABLED?: string; LIMITS?: Limits }
interface Context { request: Request; env: Env }

// Browsers may only call from the site itself; CLI and desktop clients send no Origin
const ALLOWED_ORIGINS = ['categorycolors.com', 'localhost', '127.0.0.1']
// Five of the heaviest generations fit the 30 s CPU cap in wrangler.jsonc
const MAX_RUNS = 5
// workers/limits' POLICY, for the tool descriptions, which an agent reads
// before it has a verdict to go by. Refusals take their numbers from the Worker.
const GENERATION_LIMIT = 'Rate limited to 20 generations a minute per client, and 60 a minute across everyone (each run and each fix counts, checks and exports don\'t); results report `rateLimit.remaining`, and a refusal says which limit and how many seconds until it resets.'
// What refused and when to come back, from the Worker's verdict
const limitText = ({ limit, scope, retryAfter }: Verdict, what: string) => {
  const which = limit ? `${limit} ${what} a minute ${scope === 'everyone' ? 'across all clients' : 'per client'}` : `too many ${what} this minute`
  return `Rate limited: ${which}. Retry in ${retryAfter ?? 60} s (retryAfter: ${retryAfter ?? 60}).`
}
const refusal = (verdict: Verdict) => new Error(limitText(verdict, 'generations'))

// A verdict's quota for the result; none when no limit is bound
const rateLimit = ({ remaining }: Verdict) => (remaining === undefined ? {} : { rateLimit: { remaining } })
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
      contrast: {
        type: 'array',
        description: 'One entry per contrast evaluator (or check_palette background): WCAG ratios by position, aligned to colors (or to neighbor pairs under checkAdjacent), and those below targetRatio.',
        items: {
          type: 'object',
          properties: {
            background: { type: 'string' },
            checkAdjacent: { type: 'boolean' },
            targetRatio: { type: 'number' },
            minRatio: { type: 'number' },
            pass: { type: 'boolean' },
            ratios: { type: 'array', items: { type: 'number' } },
            failing: { type: 'array', items: { type: 'object', properties: { positions: { type: 'array', items: { type: 'integer' } }, ratio: { type: 'number' } } } },
          },
        },
      },
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
  rateLimit: { type: 'object', properties: { remaining: { type: 'integer', description: 'Generations left this minute.' } }, description: 'Generations and fixes only, where a rate limit applies.' },
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

function server(allowGeneration: () => Promise<Verdict>) {
  const mcp = new McpServer({ name: 'category-colors', title: 'Category Colors', version: '1.0.0' }, { maxToolInputElements: 200 })
  mcp.registerTool('generate_palette', {
    title: 'Generate palette',
    description: 'Optimizes a new categorical color palette (for chart series, map categories, tags) with simulated annealing, maximizing perceptual distance between colors, including under color vision deficiency. Takes the full configuration as `config` (the shape the app\'s Configure panel imports), or the shortcuts, over the defaults; echoes the settings used as `config` and the random `seed`, which with the same config reproduces the result. Returns each color as CSS, hex and OKLCH, an accessibility report, and a link that opens the palette in the Category Colors app. Takes about a second per run. ' + GENERATION_LIMIT,
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
    let verdict: Verdict = { allowed: true }
    // Past the limit, the runs already made are still worth returning
    while (runs < wanted && (verdict = await allowGeneration()).allowed) {
      const result = generatePalette(params, seed + runs)
      if (!best || result.cost < best.cost) best = result
      runs += 1
    }
    if (!best) throw refusal(verdict)
    return { runs, ...(await summarize({ id: 1, params, ...best, createdAt: Date.now() })), ...rateLimit(verdict) }
  }))
  mcp.registerTool('check_palette', {
    title: 'Check palette',
    description: 'Checks whether every pair of colors stays distinguishable under normal vision and simulated protanomaly, deuteranomaly and tritanomaly, flagging pairs whose CIEDE2000 distance falls below the threshold. The report\'s minDeltaE is the closest pair under any condition, a score for comparing candidates. Given a background, the report also lists each color\'s WCAG contrast ratio against it and which fall below `ratio`. Returns the report, the settings used, and a link that opens the palette in the Category Colors app.',
    inputSchema: object({
      colors: colorList('The palette to check, in order.', 2),
      jnd: GENERATE_INPUT.jnd,
      ...CONTRAST_INPUT,
    }, ['colors']),
    outputSchema: paletteOutput(),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, tool(async (input) => {
    const params = withContrast(generateParams({ jnd: input.jnd }, DEFAULT_PARAMS), input)
    return summarize(scratch(readColors(input.colors, 2), params))
  }))
  mcp.registerTool('fix_palette', {
    title: 'Fix palette',
    description: `${FIX_DESCRIPTION} Returns the fixed palette with the report, the settings used, the seed, and a link that opens it in the Category Colors app. ${GENERATION_LIMIT}`,
    inputSchema: object({ colors: colorList('The palette to fix, in order.', 2), ...FIX_INPUT, seed: GENERATE_INPUT.seed }, ['colors']),
    outputSchema: paletteOutput({ issuesBefore: { type: 'integer', description: 'Failing pairs before the fix, counted like report.totalIssues.' } }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, tool(async (input) => {
    const colors = readColors(input.colors, 2)
    const params = fixParams(input, colors, DEFAULT_PARAMS)
    const verdict = await allowGeneration()
    if (!verdict.allowed) throw refusal(verdict)
    const issuesBefore = report(scratch(colors, params))?.totalIssues ?? 0
    return { issuesBefore, ...(await summarize({ id: 1, params, ...generatePalette(params, readSeed(input.seed)), createdAt: Date.now() })), ...rateLimit(verdict) }
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
  const verdict = await ask(env.LIMITS, 'request', ip)
  if (!verdict.allowed) {
    return new Response(limitText(verdict, 'requests'), { status: 429, headers: { 'Retry-After': String(verdict.retryAfter ?? 60) } })
  }
  const allowGeneration = () => ask(env.LIMITS, 'generate', ip)
  return originValidationResponse(request, ALLOWED_ORIGINS) ?? createMcpHandler(() => server(allowGeneration)).fetch(request)
}

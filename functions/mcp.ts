import { McpServer, createMcpHandler, fromJsonSchema, originValidationResponse } from '@modelcontextprotocol/server'
import { generatePalette } from '../src/lib/algorithm'
import { EXPORT_FORMATS, formatPalette } from '../src/lib/exporters'
import { DEFAULT_PARAMS } from '../src/lib/palette'
import { PRESET_PALETTES } from '../src/lib/presets'
import { GENERATE_INPUT, PRESET_NAMES, colorList, generateParams, readColors, scratch, summarize } from '../src/lib/tools'

// The remote MCP server (docs/mcp-server-plan.md): the WebMCP tools without
// the page, so every call stands alone and takes its colors as input. It
// speaks both the 2026-07-28 revision and 2025-era clients that still send
// `initialize`; the SDK owns the protocol.
//
// Gated for now: without an MCP_TOKEN secret the endpoint doesn't exist, and
// with one every request needs `Authorization: Bearer <token>`. Generation
// costs about a second of CPU per palette, which only Workers Paid allows.
//
// Rate limits live in workers/limits: requests and generations per client IP,
// and generations from everyone. Local runs without that Worker go unlimited.

interface Limits { allow(action: 'request' | 'generate', key: string): Promise<boolean> }
interface Env { MCP_TOKEN?: string; LIMITS?: Limits }
interface Context { request: Request; env: Env }

// Browsers may only call from the site itself; CLI and desktop clients send no Origin
const ALLOWED_ORIGINS = ['categorycolors.com', 'localhost', '127.0.0.1']

const ok = (result: object) => ({ content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result as Record<string, unknown> })
const object = (properties: object, required: string[] = []) =>
  fromJsonSchema<Record<string, unknown>>({ type: 'object', properties, required, additionalProperties: false } as never)
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
    description: 'Optimizes a new categorical color palette (for chart series, map categories, tags) with simulated annealing, maximizing perceptual distance between colors, including under color vision deficiency. Returns each color as CSS, hex and OKLCH, an accessibility report, and a link that opens the palette in the Category Colors app. Takes a second or two.',
    inputSchema: object(GENERATE_INPUT),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, tool(async (input) => {
    const params = generateParams(input, DEFAULT_PARAMS)
    if (!(await allowGeneration())) throw new Error('Too many palettes generated in the last minute. Wait a minute and try again.')
    return summarize({ id: 1, params, ...generatePalette(params), createdAt: Date.now() })
  }))
  mcp.registerTool('check_palette', {
    title: 'Check palette',
    description: 'Checks whether every pair of colors stays distinguishable under normal vision and simulated protanomaly, deuteranomaly, tritanomaly and grayscale, flagging pairs whose CIEDE2000 distance falls below the threshold. Returns the report and a link that opens the palette in the Category Colors app.',
    inputSchema: object({
      colors: colorList('The palette to check, in order.', 2),
      jnd: GENERATE_INPUT.jnd,
    }, ['colors']),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, tool(async (input) => {
    const params = generateParams({ jnd: input.jnd }, DEFAULT_PARAMS)
    return summarize(scratch(readColors(input.colors, 2), params))
  }))
  mcp.registerTool('get_preset_palette', {
    title: 'Get preset palette',
    description: 'Returns a well-known categorical palette (Okabe–Ito, Tableau 10, ColorBrewer and others) with its accessibility report, to compare against or start from.',
    inputSchema: object({ name: { type: 'string', enum: PRESET_NAMES } }, ['name']),
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
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, tool((input) => {
    const format = EXPORT_FORMATS.find((f) => f.value === input.format)?.value
    if (!format) throw new Error(`format must be one of ${EXPORT_FORMATS.map((f) => f.value).join(', ')}.`)
    return { format, text: formatPalette(readColors(input.colors, 1), format) }
  }))
  return mcp
}

// Compares digests rather than the strings, so the time taken says nothing
// about how much of the token matched
async function sameToken(given: string, expected: string) {
  const digest = async (text: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  const [a, b] = await Promise.all([digest(given), digest(expected)])
  return a.reduce((diff, byte, i) => diff | (byte ^ b[i]), 0) === 0
}

export async function onRequest({ request, env }: Context): Promise<Response> {
  if (!env.MCP_TOKEN) return new Response('Not found', { status: 404 })
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (env.LIMITS && !(await env.LIMITS.allow('request', ip))) {
    return new Response('Too many requests', { status: 429, headers: { 'Retry-After': '60' } })
  }
  const given = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1] ?? ''
  if (!(await sameToken(given, env.MCP_TOKEN))) {
    return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="category-colors"' } })
  }
  const allowGeneration = async () => !env.LIMITS || env.LIMITS.allow('generate', ip)
  return originValidationResponse(request, ALLOWED_ORIGINS) ?? createMcpHandler(() => server(allowGeneration)).fetch(request)
}

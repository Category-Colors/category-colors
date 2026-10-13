import { convertValue, parseCssColor, valueToCss } from './color'
import { formatPalette, EXPORT_FORMATS } from './exporters'
import {
  PARAM_PRESETS,
  newInitColor,
  parseParams,
  presetParams,
  type PaletteParams,
  type PaletteVersion,
} from './palette'
import { PRESET_PALETTES } from './presets'
import { buildJndReport, testTitles } from './report'
import { linkFor } from './share'

// WebMCP (https://webmachinelearning.github.io/webmcp/): the page registers
// tools on document.modelContext, and an agent in the browser calls them
// instead of clicking through the panels. Every tool goes through the same
// App callbacks the UI uses, so an agent's palette lands in history exactly
// like one made by hand. Only the draft's own shapes are declared here; the
// API is behind a flag or an origin trial, so most visitors have no
// modelContext and registration is a no-op.

interface ToolAnnotations {
  readOnlyHint?: boolean
}

export interface ModelContextTool {
  name: string
  title?: string
  description: string
  inputSchema?: object
  execute: (input: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<unknown>
  annotations?: ToolAnnotations
}

interface ModelContext {
  registerTool(tool: ModelContextTool, options?: { signal?: AbortSignal }): Promise<void>
}

export interface WebMcpApi {
  getState(): { params: PaletteParams; current: PaletteVersion | null; busy: boolean }
  // Resolves null when a run is already in progress; rejects with an
  // AbortError when the run is cancelled.
  generate(params: PaletteParams): Promise<PaletteVersion | null>
  cancel(): void
  addPalette(colors: string[]): PaletteVersion
}

const MAX_COLORS = 20
const MAX_PAIRS_PER_TEST = 10
const STYLES = PARAM_PRESETS.map((p) => p.label.toLowerCase())
const PRESET_NAMES = PRESET_PALETTES.map((p) => p.name)

const colorList = (description: string, minItems: number) => ({
  type: 'array',
  description,
  items: { type: 'string', description: 'Any CSS color: hex, rgb(), hsl(), oklch(), oklab() or a named color.' },
  minItems,
  maxItems: MAX_COLORS,
})

// Parses agent-supplied colors with the app's own parser, and names every
// value it can't read so the agent can fix them in one go.
function readColors(value: unknown, minItems: number): string[] {
  if (!Array.isArray(value)) throw new Error('colors must be an array of CSS color strings.')
  if (value.length < minItems || value.length > MAX_COLORS) {
    throw new Error(`Give between ${minItems} and ${MAX_COLORS} colors; got ${value.length}.`)
  }
  const bad = value.filter((c) => typeof c !== 'string' || !parseCssColor(c))
  if (bad.length) throw new Error(`Not valid CSS colors: ${bad.map((c) => JSON.stringify(c)).join(', ')}.`)
  return value.map((c: string) => c.trim())
}

function swatch(css: string) {
  const value = parseCssColor(css)
  if (!value) return { css }
  return { css, hex: valueToCss(convertValue(value, 'hex')), oklch: valueToCss(convertValue(value, 'oklch')) }
}

const round = (n: number) => Math.round(n * 10) / 10

// The report tab's checks: every pair of colors under normal vision and each
// simulated color vision deficiency, flagged when ΔE falls below the JND.
function report(version: PaletteVersion) {
  const result = buildJndReport(version)
  if (!result) return null
  const titles = testTitles(result.tests)
  return {
    jndThreshold: version.params.jnd,
    totalIssues: result.totalIssues,
    tests: result.tests.map((test, i) => ({
      vision: titles[i],
      issueCount: test.issueCount,
      closePairs: test.issues
        .slice()
        .sort((a, b) => a.deltaE - b.deltaE)
        .slice(0, MAX_PAIRS_PER_TEST)
        .map((pair) => ({ colors: pair.colors, positions: [pair.indexA + 1, pair.indexB + 1], deltaE: round(pair.deltaE) })),
    })),
  }
}

async function describe(version: PaletteVersion) {
  return {
    versionId: version.id,
    source: version.costHistory.length ? 'generated' : 'imported',
    edited: Boolean(version.edited),
    colors: version.colors.map(swatch),
    report: report(version),
    // Opens this palette, with the settings that made it, for whoever the agent shares it with
    link: (globalThis.location?.origin ?? 'https://categorycolors.com') + (await linkFor(version.colors, version.params)),
  }
}

// A throwaway version, so check_palette and export_palette can work on colors
// that aren't in history yet, under the panel's current criteria.
const scratch = (colors: string[], params: PaletteParams): PaletteVersion => ({
  id: -1,
  params,
  colors,
  cost: 0,
  iterations: 0,
  costHistory: [],
  createdAt: Date.now(),
})

export function webMcpTools(api: () => WebMcpApi): ModelContextTool[] {
  const current = () => {
    const { current } = api().getState()
    if (!current) throw new Error('There is no palette yet. Call generate_palette or load_preset_palette first.')
    return current
  }

  const tools: ModelContextTool[] = [
    {
      name: 'get_current_palette',
      title: 'Get current palette',
      description:
        'Returns the palette currently shown in Category Colors: each color as CSS, hex and OKLCH, whether it was generated or imported, a link that opens it in the app, and an accessibility report listing color pairs that fall below the just-noticeable-difference threshold under normal vision and simulated color vision deficiencies.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      async execute() {
        const { current } = api().getState()
        return current ? describe(current) : { palette: null, message: 'No palette yet. Call generate_palette or load_preset_palette.' }
      },
    },
    {
      name: 'generate_palette',
      title: 'Generate palette',
      description:
        'Optimizes a new categorical color palette (for chart series, map categories, tags) with simulated annealing, maximizing perceptual distance between colors, including under color vision deficiency. Uses the settings in the app\'s Configure panel unless a style is given. Takes a few seconds. The result becomes the current palette and is added to history.',
      inputSchema: {
        type: 'object',
        properties: {
          colorCount: { type: 'integer', minimum: 2, maximum: MAX_COLORS, description: 'How many colors to generate.' },
          style: {
            type: 'string',
            enum: STYLES,
            description: 'Starting recipe: vivid (saturated, mid lightness), dusky (muted, dark) or pastel (soft, light). Replaces the panel\'s settings for this run.',
          },
          fixedColors: colorList('Colors that must appear unchanged in the result, such as brand colors. The optimizer chooses the rest around them.', 1),
          jnd: {
            type: 'number',
            minimum: 5,
            maximum: 40,
            description: 'Minimum CIEDE2000 distance two colors should keep to read as different. Higher asks for more separation; the default is 20.',
          },
        },
      },
      async execute(input, options) {
        const { params, busy } = api().getState()
        if (busy) throw new Error('A palette is already being generated. Wait for it to finish, then call again.')
        const style = PARAM_PRESETS.find((p) => p.label.toLowerCase() === input.style)
        if (input.style !== undefined && !style) throw new Error(`style must be one of ${STYLES.join(', ')}.`)
        const base = structuredClone(style ? presetParams(style) : params)
        const fixed = input.fixedColors === undefined ? null : readColors(input.fixedColors, 1)
        const initColors = fixed
          ? fixed.map((css) => ({ ...newInitColor(parseCssColor(css)!), fixedColor: true }))
          : base.initColors
        const requested = typeof input.colorCount === 'number' ? input.colorCount : base.colorCount
        const draft: PaletteParams = {
          ...base,
          colorCount: Math.max(requested, fixed?.length ?? 0),
          jnd: typeof input.jnd === 'number' ? input.jnd : base.jnd,
          initColors,
        }
        // parseParams is the import path's validator: it clamps every number
        // to the range the panel allows.
        const next = parseParams(JSON.stringify(draft))
        if (!next) throw new Error('Those settings could not be turned into a valid configuration.')
        const onAbort = () => api().cancel()
        options?.signal?.addEventListener('abort', onAbort, { once: true })
        try {
          const version = await api().generate(next)
          if (!version) throw new Error('A palette is already being generated. Wait for it to finish, then call again.')
          return describe(version)
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') throw new Error('Generation was cancelled.')
          throw err
        } finally {
          options?.signal?.removeEventListener('abort', onAbort)
        }
      },
    },
    {
      name: 'load_preset_palette',
      title: 'Load preset palette',
      description:
        'Loads a well-known categorical palette (Okabe–Ito, Tableau 10, ColorBrewer and others) as the current palette, without optimizing, so it can be checked or exported.',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string', enum: PRESET_NAMES } },
        required: ['name'],
      },
      async execute(input) {
        const preset = PRESET_PALETTES.find((p) => p.name === input.name)
        if (!preset) throw new Error(`name must be one of ${PRESET_NAMES.join(', ')}.`)
        return describe(api().addPalette([...preset.colors]))
      },
    },
    {
      name: 'set_palette',
      title: 'Set palette',
      description:
        'Makes the given colors the current palette, as a new history entry, so the app\'s charts, report and exports show them. Use check_palette instead to only evaluate colors.',
      inputSchema: {
        type: 'object',
        properties: { colors: colorList('The palette, in order.', 2) },
        required: ['colors'],
      },
      async execute(input) {
        return describe(api().addPalette(readColors(input.colors, 2)))
      },
    },
    {
      name: 'check_palette',
      title: 'Check palette',
      description:
        'Checks whether every pair of colors stays distinguishable under normal vision and simulated color vision deficiencies, using the app\'s current threshold. Checks the given colors, or the current palette when none are given. Does not change anything.',
      inputSchema: {
        type: 'object',
        properties: { colors: colorList('Colors to check. Omit to check the current palette.', 2) },
      },
      annotations: { readOnlyHint: true },
      async execute(input) {
        if (input.colors === undefined) return describe(current())
        const colors = readColors(input.colors, 2)
        return { colors: colors.map(swatch), report: report(scratch(colors, api().getState().params)) }
      },
    },
    {
      name: 'export_palette',
      title: 'Export palette',
      description:
        'Returns the current palette (or the given colors) as text: raw (one color per line), css (custom properties) or json (W3C design tokens).',
      inputSchema: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: EXPORT_FORMATS.map((f) => f.value) },
          colors: colorList('Colors to export. Omit to export the current palette.', 1),
        },
        required: ['format'],
      },
      annotations: { readOnlyHint: true },
      async execute(input) {
        const format = EXPORT_FORMATS.find((f) => f.value === input.format)?.value
        if (!format) throw new Error(`format must be one of ${EXPORT_FORMATS.map((f) => f.value).join(', ')}.`)
        const colors = input.colors === undefined ? current().colors : readColors(input.colors, 1)
        return { format, text: formatPalette(colors, format) }
      },
    },
  ]
  // Chrome hands the agent only "invocation failed" when a tool rejects, and
  // logs the reason to a console nobody reads. Returning the message as the
  // result lets the agent see what to fix and call again.
  return tools.map((tool) => ({
    ...tool,
    execute: (input, options) =>
      tool.execute(input ?? {}, options).catch((err: unknown) => ({ error: err instanceof Error ? err.message : String(err) })),
  }))
}

// Registers every tool for as long as `signal` stays unaborted; aborting it
// unregisters them, per the draft.
export function registerWebMcpTools(api: () => WebMcpApi, signal: AbortSignal) {
  const context = (document as Document & { modelContext?: ModelContext }).modelContext
  if (!context) return
  for (const tool of webMcpTools(api)) {
    context.registerTool(tool, { signal }).catch((err) => {
      if (!signal.aborted) console.warn(`WebMCP: could not register ${tool.name}`, err)
    })
  }
}

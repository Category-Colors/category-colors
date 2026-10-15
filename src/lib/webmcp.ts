import { formatPalette, EXPORT_FORMATS } from './exporters'
import type { PaletteParams, PaletteVersion } from './palette'
import { PRESET_PALETTES } from './presets'
import { CONTRAST_INPUT, FIX_DESCRIPTION, FIX_INPUT, GENERATE_INPUT, PRESET_NAMES, colorList, describe, fixParams, generateParams, readColors, readSeed, report, scratch, swatch, withContrast } from './tools'

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
  generate(params: PaletteParams, seed?: number): Promise<PaletteVersion | null>
  cancel(): void
  addPalette(colors: string[]): PaletteVersion
  addPreset(colors: string[]): PaletteVersion
}


export function webMcpTools(api: () => WebMcpApi): ModelContextTool[] {
  const current = () => {
    const { current } = api().getState()
    if (!current) throw new Error('There is no palette yet. Call generate_palette or load_preset_palette first.')
    return current
  }

  // A run through the app, as the button makes one: cancelled with the
  // agent's signal, and refused while another is going
  const busy = 'A palette is already being generated. Wait for it to finish, then call again.'
  const run = async (params: PaletteParams, seed: number | undefined, signal: AbortSignal | undefined, verb: string) => {
    const onAbort = () => api().cancel()
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      const version = await api().generate(params, seed)
      if (!version) throw new Error(busy)
      return version
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw new Error(`${verb} was cancelled.`)
      throw err
    } finally {
      signal?.removeEventListener('abort', onAbort)
    }
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
        'Optimizes a new categorical color palette (for chart series, map categories, tags) with simulated annealing, maximizing perceptual distance between colors, including under color vision deficiency. Starts from the settings in the app\'s Configure panel; a style replaces them, and `config` (the full configuration, in the shape the panel imports) overrides field by field. The result echoes the settings used as `config` and the random `seed`, which with the same config reproduces it. Takes a few seconds. The result becomes the current palette and is added to history.',
      inputSchema: {
        type: 'object',
        properties: GENERATE_INPUT,
      },
      async execute(input, options) {
        const state = api().getState()
        if (state.busy) throw new Error(busy)
        return describe(await run(generateParams(input, state.params), readSeed(input.seed), options?.signal, 'Generation'))
      },
    },
    {
      name: 'fix_palette',
      title: 'Fix palette',
      description: `${FIX_DESCRIPTION} Fixes the given colors, or the current palette when none are given. The result becomes the current palette and is added to history.`,
      inputSchema: {
        type: 'object',
        properties: { colors: colorList('Colors to fix, in order. Omit to fix the current palette.', 2), ...FIX_INPUT, seed: GENERATE_INPUT.seed },
      },
      async execute(input, options) {
        const state = api().getState()
        if (state.busy) throw new Error(busy)
        const source = input.colors === undefined ? current() : { params: state.params, colors: readColors(input.colors, 2) }
        const params = fixParams(input, source.colors, source.params)
        const issuesBefore = report(scratch(source.colors, params))?.totalIssues ?? 0
        return { issuesBefore, ...(await describe(await run(params, readSeed(input.seed), options?.signal, 'Fixing'))) }
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
        return describe(api().addPreset([...preset.colors]))
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
        'Checks whether every pair of colors stays distinguishable under normal vision and simulated color vision deficiencies. Uses the given jnd threshold, or the app\'s current one, and echoes the settings used as `config`. The report\'s minDeltaE is the closest pair under any condition, a score for comparing candidates. With a background, the report adds each color\'s WCAG contrast against it. Checks the given colors, or the current palette when none are given. Does not change anything.',
      inputSchema: {
        type: 'object',
        properties: { colors: colorList('Colors to check. Omit to check the current palette.', 2), jnd: GENERATE_INPUT.jnd, ...CONTRAST_INPUT },
      },
      annotations: { readOnlyHint: true },
      async execute(input) {
        const params = withContrast(generateParams({ jnd: input.jnd }, api().getState().params), input)
        if (input.colors === undefined) {
          const version = current()
          return describe({ ...version, params: input.jnd === undefined ? withContrast(version.params, input) : params })
        }
        const colors = readColors(input.colors, 2)
        return { colors: colors.map((css) => swatch(css, params.colorSpace.gamut)), report: report(scratch(colors, params)), config: params }
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

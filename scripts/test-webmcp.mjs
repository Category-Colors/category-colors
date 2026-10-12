import assert from 'node:assert/strict'

// The WebMCP tools against a stand-in for App: the same callbacks, with state
// held in plain variables so each assertion can see exactly what a tool did.
export async function testWebMcp(server) {
  const { webMcpTools, registerWebMcpTools } = await server.ssrLoadModule('/src/lib/webmcp.ts')
  const { DEFAULT_PARAMS } = await server.ssrLoadModule('/src/lib/palette.ts')

  let state
  const generated = []
  const api = {
    getState: () => state,
    async generate(params) {
      generated.push(params)
      const version = { id: 7, params, colors: ['#e69f00', '#56b4e9', '#009e73'], cost: 0.1, iterations: 100, costHistory: [[0, 1], [100, 0.1]], createdAt: 1 }
      state = { ...state, current: version }
      return version
    },
    cancel() {},
    addPalette(colors) {
      const version = { id: 8, params: state.params, colors, cost: 0, iterations: 0, costHistory: [], createdAt: 1 }
      state = { ...state, current: version }
      return version
    },
  }
  const reset = () => { state = { params: structuredClone(DEFAULT_PARAMS), current: null, busy: false }; generated.length = 0 }
  const tools = Object.fromEntries(webMcpTools(() => api).map((tool) => [tool.name, tool]))
  const call = (name, input = {}) => tools[name].execute(input, { signal: new AbortController().signal })

  // Every tool satisfies the draft's required members, with names unique and
  // schemas that are plain JSON objects.
  assert.deepEqual(Object.keys(tools).sort(), ['check_palette', 'export_palette', 'generate_palette', 'get_current_palette', 'load_preset_palette', 'set_palette'])
  for (const tool of Object.values(tools)) {
    assert.ok(tool.description.length > 40, `${tool.name} needs a description an agent can act on`)
    assert.equal(tool.inputSchema.type, 'object')
    assert.deepEqual(JSON.parse(JSON.stringify(tool.inputSchema)), tool.inputSchema)
  }
  assert.equal(tools.get_current_palette.annotations.readOnlyHint, true)
  assert.equal(tools.check_palette.annotations.readOnlyHint, true)
  assert.equal(tools.export_palette.annotations.readOnlyHint, true)
  assert.equal(tools.generate_palette.annotations, undefined)

  reset()
  assert.equal((await call('get_current_palette')).palette, null)
  assert.match((await call('export_palette', { format: 'css' })).error, /no palette yet/)

  // load_preset_palette lands the preset in history, and the result carries
  // hex, OKLCH and the report.
  let result = await call('load_preset_palette', { name: 'Okabe–Ito' })
  assert.equal(result.source, 'imported')
  assert.equal(result.colors.length, 8)
  assert.equal(result.colors[0].hex, '#E69F00')
  assert.match(result.colors[0].oklch, /^oklch\(/)
  assert.equal(result.report.jndThreshold, 20)
  assert.equal(result.report.tests[0].vision, 'No CVD')
  assert.deepEqual(await call('get_current_palette'), result)
  assert.match((await call('load_preset_palette', { name: 'Nope' })).error, /name must be one of/)

  // set_palette validates every color and names the bad ones. Failures come
  // back as { error } results, because Chrome hides a rejection's message.
  result = await call('set_palette', { colors: ['red', 'oklch(0.7 0.15 250)'] })
  assert.equal(result.colors[0].hex, '#FF0000')
  assert.equal(result.colors[1].css, 'oklch(0.7 0.15 250)')
  assert.match(result.colors[1].hex, /^#[0-9A-F]{6}$/)
  assert.match((await call('set_palette', { colors: ['red', 'blurple', 42] })).error, /Not valid CSS colors: "blurple", 42/)
  assert.match((await call('set_palette', { colors: ['red'] })).error, /between 2 and 20/)

  // check_palette reports near-identical colors as an issue under normal
  // vision, and doesn't touch history.
  const before = state.current
  result = await call('check_palette', { colors: ['#ff0000', '#fe0101', '#0000ff'] })
  assert.ok(result.report.tests[0].issueCount >= 1)
  assert.deepEqual(result.report.tests[0].closePairs[0].positions, [1, 2])
  assert.equal(state.current, before)

  // export_palette uses the app's own formatter.
  result = await call('export_palette', { format: 'css', colors: ['#112233'] })
  assert.match(result.text, /--palette-1: #112233/)
  assert.match((await call('export_palette', { format: 'svg' })).error, /format must be one of/)

  // generate_palette builds on the panel's params, clamps through
  // parseParams, pins fixed colors, and grows the count to fit them.
  reset()
  result = await call('generate_palette', { colorCount: 2, jnd: 99, fixedColors: ['#ff0000', '#00ff00', '#0000ff'] })
  assert.equal(result.source, 'generated')
  const [sent] = generated
  assert.equal(sent.colorCount, 3)
  assert.equal(sent.jnd, 40)
  assert.equal(sent.evaluators.length, DEFAULT_PARAMS.evaluators.length)
  assert.deepEqual(sent.initColors.map((c) => [c.value.hex, c.fixedColor]), [['#FF0000', true], ['#00FF00', true], ['#0000FF', true]])
  reset()
  await call('generate_palette', { style: 'pastel' })
  assert.equal(generated[0].colorCount, 6)
  assert.deepEqual(generated[0].colorSpace.ranges[2], [0.78, 0.92])
  assert.match((await call('generate_palette', { style: 'neon' })).error, /style must be one of/)
  state.busy = true
  assert.match((await call('generate_palette', {})).error, /already being generated/)

  // A cancelled run surfaces as a readable error, and aborting the call
  // cancels the run.
  reset()
  let cancelled = 0
  const abortable = {
    ...api,
    cancel: () => { cancelled += 1 },
    generate: () => new Promise((_, reject) => setTimeout(() => reject(new DOMException('Generation cancelled', 'AbortError')), 10)),
  }
  const [generateTool] = webMcpTools(() => abortable).filter((t) => t.name === 'generate_palette')
  const controller = new AbortController()
  const pending = generateTool.execute({}, { signal: controller.signal })
  controller.abort()
  assert.deepEqual(await pending, { error: 'Generation was cancelled.' })
  assert.equal(cancelled, 1)

  // Registration: a no-op without modelContext; otherwise every tool is
  // registered with the caller's signal, which is how the draft unregisters.
  const registered = []
  globalThis.document = {}
  registerWebMcpTools(() => api, new AbortController().signal)
  const registration = new AbortController()
  globalThis.document = { modelContext: { registerTool: async (tool, options) => { registered.push([tool.name, options.signal]) } } }
  registerWebMcpTools(() => api, registration.signal)
  assert.equal(registered.length, 6)
  assert.ok(registered.every(([, signal]) => signal === registration.signal))
  delete globalThis.document

  console.log('WebMCP tool checks passed.')
}

import assert from 'node:assert/strict'
import { createDefaultConfig, palettes } from 'category-colors'
import { differenceCiede2000, formatHex } from 'culori'
import { createServer } from 'vite'
import { testLaunch } from './test-launch.mjs'
import { testWebMcp } from './test-webmcp.mjs'
import { testAgents } from './test-agents.mjs'
import { testShare } from './test-share.mjs'
import { testMcp } from './test-mcp.mjs'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

try {
  const color = await server.ssrLoadModule('/src/lib/color.ts')
  const palette = await server.ssrLoadModule('/src/lib/palette.ts')
  const exporters = await server.ssrLoadModule('/src/lib/exporters.ts')
  const theme = await server.ssrLoadModule('/src/lib/theme.ts')

  assert.deepEqual(color.normalizeColorValue({ space: 'rgb', r: 300, g: 12.4, b: -2 }), {
    space: 'rgb',
    r: 255,
    g: 12,
    b: 0,
  })
  assert.equal(color.normalizeColorValue({ space: 'rgb', r: '255', g: 0, b: 0 }), null)
  assert.equal(color.normalizeColorValue({ space: 'unknown', value: '#fff' }), null)
  assert.deepEqual(color.normalizeColorValue({ space: 'hex', hex: '#abc' }), {
    space: 'hex',
    hex: '#AABBCC',
  })

  // Gamut: never stored as sRGB, moved to OKLCH from a space that can't reach
  // past it, and dropped on import where the space can't use it
  const okhsl = palette.defaultColorSpace('okhsl')
  assert.deepEqual(palette.withGamut(okhsl, 'srgb'), okhsl)
  assert.deepEqual(palette.withGamut(okhsl, 'display-p3'), { ...palette.defaultColorSpace('oklch'), gamut: 'display-p3' })
  assert.deepEqual(palette.withGamut({ ...palette.defaultColorSpace('oklab'), gamut: 'rec2020' }, 'srgb'), palette.defaultColorSpace('oklab'))
  const parsedSpace = (colorSpace) => palette.parseParams(JSON.stringify({ initColors: [], targets: [], evaluators: [], colorSpace })).colorSpace
  assert.equal(parsedSpace({ ...palette.defaultColorSpace('oklch'), gamut: 'display-p3' }).gamut, 'display-p3')
  assert.equal('gamut' in parsedSpace({ ...okhsl, gamut: 'display-p3' }), false)
  assert.equal('gamut' in parsedSpace({ ...palette.defaultColorSpace('oklch'), gamut: 'srgb' }), false)
  // Locks survive a change of space only on the same channel: hue and
  // lightness carry from okhsl to oklch; rgb's Blue isn't oklab's Blue–yellow
  const locked = (mode, lockedChannels) => ({ ...palette.DEFAULT_PARAMS, colorSpace: palette.defaultColorSpace(mode), initColors: [{ ...palette.newInitColor(), lockedChannels }] })
  assert.deepEqual(palette.inSpace(locked('okhsl', ['h', 's', 'l']), palette.defaultColorSpace('oklch')).initColors[0].lockedChannels, ['h', 'l'])
  assert.deepEqual(palette.inSpace(locked('rgb', ['b']), palette.defaultColorSpace('oklab')).initColors[0].lockedChannels, [])
  // and through Refine, while the seed is still the color in its slot
  const report = await server.ssrLoadModule('/src/lib/report.ts')
  const seeded = { ...locked('okhsl', ['h']), orderOptimization: false }
  assert.deepEqual(report.refineParams({ params: seeded, colors: ['#ff0000', '#00ff00'] }).initColors.map((c) => c.lockedChannels), [['h'], []])
  assert.deepEqual(report.refineParams({ params: { ...seeded, orderOptimization: true }, colors: ['#ff0000', '#00ff00'] }).initColors[0].lockedChannels, [])
  assert.equal(color.outsideSrgb('oklch(0.7 0.3 150)'), true)
  assert.equal(color.outsideSrgb('#00FF00'), false)

  const imported = palette.parseParams(
    JSON.stringify({
      colorCount: 99,
      jnd: -4,
      maxIterations: 1_000_000,
      orderOptimization: false,
      colorSpace: {
        mode: 'oklch',
        ranges: [
          [2, -1],
          [0.6, 0.1],
          [400, -20],
        ],
      },
      initColors: [
        { value: { space: 'rgb', r: 300, g: 20, b: -1 }, fixedColor: true },
        { value: { space: 'rgb', r: 'bad', g: 20, b: 40 } },
      ],
      targets: [{ value: { space: 'hex', hex: '#123' } }, { value: { space: 'wat' } }],
      evaluators: [
        {
          type: 'contrast',
          weight: 8,
          cvd: 'not-real',
          cvdSeverity: -1,
          background: 'not-a-color',
          ratio: 99,
          avoidRadius: 4,
        },
        { type: 'not-real' },
      ],
    })
  )
  assert.ok(imported)
  assert.equal(imported.colorCount, 20)
  assert.equal(imported.jnd, 5)
  assert.equal(imported.maxIterations, 100_000)
  assert.equal(imported.orderOptimization, false)
  // Pairs as files before 3.3 wrote them, each clamped; on hue, a backwards
  // pair is the arc through zero, and [400, -20] clamps to [360, 0], an arc
  // of no width: a point at 0, as the package reads the same JSON
  assert.deepEqual(imported.colorSpace.ranges, [
    [[0, 1]],
    [[0.1, 0.4]],
    [[0, 0]],
  ])
  const windows = palette.parseParams(
    JSON.stringify({
      initColors: [], targets: [], evaluators: [],
      colorSpace: { mode: 'oklch', ranges: [[[0.2, 0.4], [0.3, 0.6], [0.9, 0.9]], [0, 0.2], [300, 60]] },
    })
  )
  assert.deepEqual(windows.colorSpace.ranges, [[[0.2, 0.6]], [[0, 0.2]], [[0, 60], [300, 360]]])
  // the arc rule lives in tidyWindows, keyed by the channel's period
  assert.deepEqual(palette.tidyWindows([[300, 60]], 360), [[0, 60], [300, 360]])
  assert.deepEqual(palette.tidyWindows([[300, 60]]), [[60, 300]])
  assert.deepEqual(palette.tidyWindows([[5, 5]]), [[5, 5]])
  assert.deepEqual(palette.tidyWindows([[3, 1], [5, 5], [2, 4]]), [[1, 4]])
  assert.equal(imported.initColors.length, 1)
  assert.deepEqual(imported.initColors[0].value, { space: 'rgb', r: 255, g: 20, b: 0 })
  assert.equal(imported.targets.length, 1)
  assert.equal(imported.evaluators.length, 1)
  assert.equal(imported.evaluators[0].weight, 1)
  assert.equal(imported.evaluators[0].background, '#ffffff')
  assert.equal(imported.evaluators[0].ratio, 7)
  assert.equal(imported.evaluators[0].avoidRadius, 0.5)
  assert.equal(palette.parseParams('x'.repeat(1_000_001)), null)

  // Grayscale is a print check with no meaningful degree: the editor hides the
  // Severity control, so the value that reaches the library has to be pinned
  // here rather than read off the spec — and switching back to a deficiency
  // must return the severity the user actually set.
  assert.equal(palette.cvdSeverityFor({ cvd: 'grayscale', cvdSeverity: 0.5 }), 1)
  assert.equal(palette.cvdSeverityFor({ cvd: 'grayscale', cvdSeverity: 0 }), 1)
  assert.equal(palette.cvdSeverityFor({ cvd: 'deuteranomaly', cvdSeverity: 0.35 }), 0.35)
  // and a hand-edited file can still name it (parseParams gates cvd on CVD_TYPES)
  const gs = palette.parseParams(
    JSON.stringify({
      initColors: [],
      targets: [],
      evaluators: [{ type: 'cvd', cvd: 'grayscale', weight: 0.1 }],
    })
  )
  assert.equal(gs.evaluators[0].cvd, 'grayscale')

  const colors = ['#FF0000', 'rgb(0, 255, 0)', 'oklch(0.5 0.2 250)']
  for (const format of ['raw', 'css', 'json']) {
    const formatted = exporters.formatPalette(colors, format)
    assert.equal(exporters.parsePalette(formatted).length, colors.length)
  }
  assert.deepEqual(exporters.parsePalette('red\nrebeccapurple'), ['#FF0000', '#663399'])
  assert.deepEqual(exporters.parsePalette('red\n#fff\nrgb(0, 0, 0)'), ['#FF0000', '#FFFFFF', '#000000'])
  assert.equal(color.valueToCss(color.convertValue(color.parseCssColor(exporters.parsePalette(':root { --first: hwb(0 0% 0%); }')[0]), 'hex')), '#FF0000')

  assert.equal(theme.polarityOf('rgb(250, 250, 250)'), 'light')
  assert.equal(theme.polarityOf('oklch(0.2 0 0)'), 'dark')
  assert.equal(theme.polarityOf('not-a-color'), 'dark')

  const weather = await server.ssrLoadModule('/src/lib/weather.ts')
  const originalFetch = globalThis.fetch
  let requests = 0
  try {
    globalThis.fetch = async (_url, options) => {
      requests += 1
      assert.ok(options.signal instanceof AbortSignal)
      if (requests === 1) throw new Error('offline')
      return { ok: true, json: async () => weather.CITIES.map(() => ({
        utc_offset_seconds: 0,
        hourly: {
          time: ['2026-09-07T00:00', '2026-09-07T01:00'],
          temperature_2m: [20, 21],
          relative_humidity_2m: [50, 51],
          shortwave_radiation: [0, 10],
        },
        daily: {
          time: Array.from({ length: 7 }, (_, i) => `2026-09-${String(7 + i).padStart(2, '0')}`),
          precipitation_sum: Array(7).fill(2),
          sunshine_duration: Array(7).fill(3600),
        },
      })) }
    }
    await assert.rejects(weather.fetchWeather(), /offline/)
    const retry = weather.fetchWeather()
    assert.equal(weather.fetchWeather(), retry, 'Concurrent requests share one fetch')
    const forecast = await retry
    assert.equal(forecast.cities.length, 20)
    assert.equal(forecast.cities[0].precipTotal, 14)
    assert.deepEqual(forecast.cities[0].sunshineDaily, Array(7).fill(1))
    assert.equal(await weather.fetchWeather(), forecast)
    assert.equal(requests, 2, 'A successful retry is cached')
  } finally {
    globalThis.fetch = originalFetch
  }

  const { extractColors } = await server.ssrLoadModule('/src/lib/extract-colors.ts')
  const originalBitmap = globalThis.createImageBitmap
  const originalDocument = globalThis.document
  let closed = false
  try {
    globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close: () => { closed = true } })
    globalThis.document = { createElement: () => ({ getContext: () => ({
      drawImage() {},
      getImageData: () => ({ data: new Uint8ClampedArray([255, 0, 0, 255]) }),
    }) }) }
    assert.deepEqual(await extractColors(new Blob()), ['#FF0000'])
    assert.equal(closed, true)
  } finally {
    globalThis.createImageBitmap = originalBitmap
    globalThis.document = originalDocument
  }

  const { buildConfig, generatePalette } = await server.ssrLoadModule('/src/lib/algorithm.ts')

  // The app's DEFAULT_EVALUATORS are a hand-copy of the library's
  // createDefaultConfig(), so a library bump that retunes the weights would
  // otherwise drift them apart in silence — which is exactly what 3.0 did to
  // the 2.x weights. Compare what buildConfig actually hands the optimizer
  // against what the library would have used.
  //
  // Two deliberate differences, both asserted rather than skipped: the app
  // drops `similarity` (it starts with no targets, so the term has nothing to
  // pull toward), and it names the anomaly variants where the library names
  // the dichromacies. Those are the same culori filter — Machado has no
  // separate dichromacy matrix — so severity is what distinguishes them, and
  // the family is compared rather than the label.
  {
    const family = (type) => type.replace(/(anomaly|anopia)$/, '')
    const shape = (entries) =>
      entries
        .filter((e) => e.function.name !== 'evaluateSimilarity')
        .map((e) => [
          e.function.name,
          e.weight,
          e.cvd ? `${family(e.cvd.type)}@${e.cvd.severity}` : '',
        ].join(' '))

    assert.deepEqual(
      shape(buildConfig(palette.DEFAULT_PARAMS).evalFunctions),
      shape(createDefaultConfig().evalFunctions),
      'app DEFAULT_EVALUATORS have drifted from the library default config'
    )
  }

  // PRESET_PALETTES duplicates the package's `palettes` on purpose: presets.ts
  // is main-bundle code (EmptyState imports it) and the package root pulls the
  // optimizer with it, which MainTabs deliberately keeps in the lazy report
  // chunk. So the values are copied and checked here instead, where importing
  // the root costs nothing.
  //
  // Hexes, not scores. A palette can shift without any measured number moving —
  // correcting Tableau 10's yellow to #edc948 left the minimum deltaE identical
  // to nine decimals, because the closest pair doesn't involve the yellow — so a
  // guard keyed to a metric would assert on a difference that carries no meaning
  // and go red whenever the metric code changed.
  //
  // Two of these agree on a prefix rather than end to end, and are checked on
  // that prefix rather than left to a comment. "Okabe–Ito" here is Wilke's
  // eight colour colorblindr set, which is exactly the package's first eight —
  // the package adds black as a ninth. Note colorblindr also ships an eight
  // colour variant ending in black instead of grey; only the grey one is a
  // clean prefix, and this is the grey one. "ColorBrewer Set3" runs the other
  // way: the app carries the full twelve and the package's `colorBrewer3_10`
  // is its first ten.
  //
  // `shared` is asserted against the shorter of the two, so a length change on
  // either side fails rather than quietly shrinking what this covers. If the
  // package ever grows a full Set3 or a colorblindr-shaped Okabe–Ito, that is
  // a one number edit here and more coverage, not a false alarm.
  {
    const presets = await server.ssrLoadModule('/src/lib/presets.ts')
    const byName = new Map(presets.PRESET_PALETTES.map((p) => [p.name, p.colors]))
    const tracked = [
      // [preset name, package export, colours the two are expected to share]
      ['Tableau 10', 'tableau10', 10],
      ['Observable 10', 'observable10', 10],
      ['IBM Carbon', 'carbon', 14],
      ['Petroff 6', 'petroff6', 6],
      ['Petroff 8', 'petroff8', 8],
      ['Petroff 10', 'petroff10', 10],
      ['Okabe–Ito', 'okabeIto', 8],
      ['ColorBrewer Set3', 'colorBrewer3_10', 10],
    ]
    for (const [name, source, shared] of tracked) {
      const app = byName.get(name)?.map((hex) => hex.toLowerCase())
      const pkg = palettes[source].map((color) => formatHex(color))
      assert.ok(app, `${name} is missing from PRESET_PALETTES`)
      assert.equal(
        Math.min(app.length, pkg.length),
        shared,
        `${name} and the package's ${source} no longer overlap by ${shared} colors`
      )
      assert.deepEqual(
        app.slice(0, shared),
        pkg.slice(0, shared),
        `${name} has drifted from the package's ${source}`
      )
    }
  }

  for (const mode of ['rgb', 'hsl', 'okhsl', 'oklch', 'oklab']) {
    const result = generatePalette({ ...structuredClone(palette.DEFAULT_PARAMS),
      colorCount: 2, maxIterations: 1000, orderOptimization: false,
      colorSpace: palette.defaultColorSpace(mode),
    })
    assert.equal(result.colors.length, 2)
    assert.ok(result.colors.every((value) => color.parseCssColor(value)))
    assert.ok(Number.isFinite(result.cost))
  }

  // Refine: a version's colors become pinned seeds, the ones outside the
  // failing pairs' cover are fixed, and fix behavior clears pairs without
  // touching what was fixed
  {
    const report = await server.ssrLoadModule('/src/lib/report.ts')
    const okabeIto = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#999999']
    const version = { id: 1, params: structuredClone(palette.DEFAULT_PARAMS), colors: okabeIto, cost: 0, iterations: 0, costHistory: [], createdAt: 0 }
    const refine = report.refineParams(version)
    assert.equal(refine.behavior, 'fix')
    assert.ok(refine.initColors.every((c) => c.fixedOrder))
    const free = refine.initColors.filter((c) => !c.fixedColor).length
    assert.ok(free > 0 && free < okabeIto.length, `cover frees ${free} of ${okabeIto.length}`)
    const result = generatePalette(refine, 1)
    refine.initColors.forEach((c, i) => {
      if (c.fixedColor) assert.equal(result.colors[i], okabeIto[i], `fixed seed ${i} moved`)
    })
    const issues = (colors) => report.buildJndReport({ ...version, params: refine, colors }).totalIssues
    assert.ok(issues(result.colors) < issues(okabeIto) / 2, `${issues(okabeIto)} issues -> ${issues(result.colors)}`)
    // a seed the person fixed stays fixed even when it sits in a failing pair
    // (found by value, as runs return fixed seeds exactly as written)
    const freed = refine.initColors.findIndex((c) => !c.fixedColor)
    const pin = { ...palette.newInitColor(color.parseCssColor(okabeIto[freed])), fixedColor: true }
    const pinnedColors = okabeIto.map((h, i) => (i === freed ? color.valueToCss(pin.value) : h))
    const pinnedRefine = report.refineParams({ params: { ...version.params, initColors: [pin] }, colors: pinnedColors })
    assert.equal(pinnedRefine.initColors[freed].fixedColor, true)
    assert.ok(pinnedRefine.initColors.some((c) => !c.fixedColor))
    // with nothing failing, every seed is fixed: a fix has nothing to move
    const passing = report.refineParams({ params: { ...version.params, jnd: 5 }, colors: okabeIto })
    assert.ok(passing.initColors.every((c) => c.fixedColor))
    // the space stretches to hold the palette, so preparing the run leaves
    // every seed where it was (under the defaults the grey moved 12 ΔE)
    const { prepareInitialState } = await server.ssrLoadModule('category-colors')
    const { toCulori } = await server.ssrLoadModule('/src/lib/color.ts')
    const prepared = prepareInitialState({ colors: refine.initColors.map((c) => ({ color: toCulori(c.value) })) }, buildConfig(refine))
    assert.deepEqual(prepared.colors.map((c) => formatHex(c)), okabeIto.map((h) => h.toLowerCase()))
    assert.equal(palette.parseParams(JSON.stringify(refine)).behavior, 'fix')
    assert.equal(palette.parseParams(JSON.stringify({ ...refine, fixStrength: 4 })).fixStrength, 1)
    // Strength runs the schedule from all of it down to 45%
    const { scheduleFor } = await server.ssrLoadModule('/src/lib/fix.ts')
    assert.equal(scheduleFor(1), 1)
    assert.ok(Math.abs(scheduleFor(0) - 0.45) < 1e-9)
    // and the weakest strength moves the freed colors far less than the full one
    const ciede = differenceCiede2000()
    const travel = (strength) =>
      generatePalette({ ...refine, fixStrength: strength }, 1).colors.reduce((sum, c, i) => sum + ciede(c, okabeIto[i]), 0)
    assert.ok(travel(0) < travel(1) * 0.7, `travel at strength 0 (${travel(0)}) vs 1 (${travel(1)})`)
    assert.equal(palette.parseParams(JSON.stringify({ ...refine, behavior: 'nonsense' })).behavior, 'optimize')
    assert.equal(palette.parseParams(JSON.stringify({ ...refine, behavior: 'evaluate' })).behavior, 'evaluate')
  }

  // colorSpaceContaining stretches the nearest edge, around the circle on hue
  {
    const space = { mode: 'okhsl', ranges: [[[100, 200]], [[0.2, 0.8]], [[0.3, 0.9]]] }
    // 350 is 110° back from 100 through zero, nearer than 150° on from 200
    const wide = palette.colorSpaceContaining(space, ['oklch(0.6 0.15 350)', '#ffffff'])
    const hue = wide.ranges[0].map(([a, b]) => [Math.round(a), Math.round(b)])
    assert.deepEqual(hue, [[0, 200], [350, 360]])
    assert.deepEqual(palette.colorSpaceContaining(space, ['oklch(0.6 0.15 30)']).ranges[0].map(([a, b]) => [Math.round(a), b]), [[30, 200]])
    assert.equal(wide.ranges[2].at(-1)[1], 1) // white lifts the lightness ceiling
    assert.deepEqual(palette.colorSpaceContaining(space, ['#808080']).ranges[0], [[100, 200]]) // grey: no hue
    // a preset brings the defaults, at its own size, not the panel's settings
    const preset = palette.paletteParams(['#E69F00', '#999999', '#56B4E9'])
    assert.equal(preset.colorCount, 3)
    assert.equal(preset.behavior, 'optimize')
    assert.deepEqual(preset.evaluators.map((e) => e.type), palette.DEFAULT_PARAMS.evaluators.map((e) => e.type))
  }

  console.log('Core regression checks passed.')
  await testLaunch(server)
  await testWebMcp(server)
  await testAgents(server)
  await testShare(server)
  await testMcp(server)
} finally {
  await server.close()
}

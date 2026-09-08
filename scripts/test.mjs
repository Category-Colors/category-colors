import assert from 'node:assert/strict'
import { createDefaultConfig, palettes } from 'category-colors'
import { formatHex } from 'culori'
import { createServer } from 'vite'
import { testLaunch } from './test-launch.mjs'

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
  assert.deepEqual(imported.colorSpace.ranges, [
    [0, 1],
    [0.1, 0.4],
    [0, 360],
  ])
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
  // Two shared names are deliberately absent. "Okabe–Ito" here is the eight
  // colour colorblindr variant; the package carries all nine, including black.
  // "ColorBrewer Set3" is the full twelve; the package's `colorBrewer3_10` is
  // the ten colour cut. Neither is drift, and neither should be "fixed" into
  // agreement.
  {
    const presets = await server.ssrLoadModule('/src/lib/presets.ts')
    const byName = new Map(presets.PRESET_PALETTES.map((p) => [p.name, p.colors]))
    const tracked = [
      ['Tableau 10', 'tableau10'],
      ['Observable 10', 'observable10'],
      ['IBM Carbon', 'carbon'],
      ['Petroff 6', 'petroff6'],
      ['Petroff 8', 'petroff8'],
      ['Petroff 10', 'petroff10'],
    ]
    for (const [name, source] of tracked) {
      assert.deepEqual(
        byName.get(name)?.map((hex) => hex.toLowerCase()),
        palettes[source].map((color) => formatHex(color)),
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

  console.log('Core regression checks passed.')
  await testLaunch(server)
} finally {
  await server.close()
}

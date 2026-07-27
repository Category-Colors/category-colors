import assert from 'node:assert/strict'
import { createServer } from 'vite'

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

  const colors = ['#FF0000', 'rgb(0, 255, 0)', 'oklch(0.5 0.2 250)']
  for (const format of ['raw', 'css', 'json']) {
    const formatted = exporters.formatPalette(colors, format)
    assert.equal(exporters.parsePalette(formatted).length, colors.length)
  }
  assert.deepEqual(exporters.parsePalette('red\nrebeccapurple'), ['#FF0000', '#663399'])
  assert.deepEqual(exporters.parsePalette(':root { --first: hwb(0 0% 0%); }'), ['#FF0000'])

  assert.equal(theme.polarityOf('rgb(250, 250, 250)'), 'light')
  assert.equal(theme.polarityOf('oklch(0.2 0 0)'), 'dark')
  assert.equal(theme.polarityOf('not-a-color'), 'dark')

  console.log('Core regression checks passed.')
} finally {
  await server.close()
}

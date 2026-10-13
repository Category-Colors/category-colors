import assert from 'node:assert/strict'
import { deflateRawSync, inflateRawSync } from 'node:zlib'

// Shareable links: colors survive exactly, settings round-trip as a deflated
// diff, and whatever a link carries goes through the import validator.
export async function testShare(server) {
  const { linkFor, readLink } = await server.ssrLoadModule('/src/lib/share.ts')
  const palette = await server.ssrLoadModule('/src/lib/palette.ts')
  const { oklchCss } = await server.ssrLoadModule('/src/lib/color.ts')
  const read = (link) => readLink(new URL(link, 'https://categorycolors.com'))
  const settings = (params) => JSON.stringify(params, (key, value) => (key === 'id' ? undefined : value))
  const defaults = settings(palette.parseParams(settings(palette.DEFAULT_PARAMS)))

  // Generated colors are OKLCH at 4 decimals, not 8-bit hex
  assert.equal(oklchCss('#e8a33d'), 'oklch(0.7649 0.1399 72.9499)')
  assert.equal(oklchCss('#808080'), 'oklch(0.5999 0 0)')

  // Nothing to share, and defaults stay out of the link. If this fails because
  // the app's defaults changed, links still work (they just carry the change);
  // update this test, and leave LINK_BASE alone.
  assert.equal(await linkFor([], palette.DEFAULT_PARAMS), '/')
  // including after a reload, which runs settings through the import validator
  assert.equal(await linkFor([], palette.parseParams(settings(palette.DEFAULT_PARAMS))), '/')
  assert.equal(await linkFor(['#e8a33d', 'oklch(0.5997 0.1773 260.75)'], palette.DEFAULT_PARAMS), '/?colors=%23e8a33d,oklch(0.5997%200.1773%20260.75)')
  assert.equal(await read('/'), null)

  // Every notation and digit survives, including the commas inside rgb()
  const colors = ['#E8A33D', 'oklch(0.7649 0.1399 72.9499)', 'rgb(12, 200, 99)', 'hsl(210 50% 40%)', 'oklab(0.5 -0.1 0.05)']
  const custom = {
    ...palette.presetParams(palette.PARAM_PRESETS[1]),
    jnd: 25,
    initColors: [{ ...palette.newInitColor({ space: 'oklch', l: 0.62, c: 0.19, h: 29 }), fixedColor: true }],
    evaluators: [...palette.DEFAULT_PARAMS.evaluators, palette.newEvaluatorSpec('avoid', { avoidColors: [palette.newTargetColor({ space: 'hex', hex: '#FF0000' })] })],
  }
  const link = await linkFor(colors, custom)
  assert.match(link, /^\/\?colors=[^#]+#config=[\w-]+$/)
  const shared = await read(link)
  assert.deepEqual(shared.colors, colors)
  assert.equal(settings(shared.params), settings(palette.parseParams(settings(custom))))
  // and the decoded settings encode to the same link
  assert.equal(await linkFor(shared.colors, shared.params), link)
  // Only what changed goes in the hash
  const changed = (link) => JSON.parse(inflateRawSync(Buffer.from(link.split('#config=')[1], 'base64url')))
  assert.deepEqual(changed(await linkFor([], { ...palette.parseParams(settings(palette.DEFAULT_PARAMS)), jnd: 25 })), { jnd: 25 })

  // A link written by hand: unescaped spaces and commas, no #config (the defaults)
  const typed = await read('/?colors=oklch(0.7 0.1 30), rgb(1, 2, 3),%23abc,not-a-color')
  assert.deepEqual(typed.colors, ['oklch(0.7 0.1 30)', 'rgb(1, 2, 3)', '#abc'])
  assert.equal(settings(typed.params), defaults)

  // Settings from a link are untrusted: clamped, and unreadable ones fall back
  // to the defaults without losing the colors
  const config = (value) => `#config=${deflateRawSync(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')}`
  assert.equal((await read(`/${config({ colorCount: 99, jnd: -4 })}`)).params.colorCount, 20)
  for (const bad of ['#config=not!base64', '#config=AAAA', config('[1,2]'), config('nonsense'), config({ evaluators: 'x' })]) {
    const result = await read(`/?colors=%23abc${bad}`)
    assert.deepEqual(result.colors, ['#abc'], bad)
    assert.equal(settings(result.params), defaults, bad)
  }
  // A decompression bomb stops at the cap rather than filling memory
  const bomb = await read(`/?colors=%23abc${config(`{"jnd":5,"x":"${' '.repeat(5_000_000)}"}`)}`)
  assert.equal(bomb.params.jnd, palette.DEFAULT_PARAMS.jnd)

  console.log('Share link checks passed.')
}

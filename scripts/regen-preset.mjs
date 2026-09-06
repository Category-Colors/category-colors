// Regenerates PRESET_PALETTE by running generatePalette with DEFAULT_PARAMS —
// the same code path Generate takes with untouched settings — and rewrites
// preset-history.ts with the recorded loss curve.
import fs from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

try {
  const { DEFAULT_PARAMS } = await server.ssrLoadModule('/src/lib/palette.ts')
  const { generatePalette } = await server.ssrLoadModule('/src/lib/algorithm.ts')
  const result = generatePalette(DEFAULT_PARAMS)

  const history = result.costHistory.map(([i, c]) => [i, Number(c.toFixed(4))])
  const lines = []
  for (let i = 0; i < history.length; i += 6) {
    lines.push('  ' + history.slice(i, i + 6).map(([a, b]) => `[${a}, ${b}]`).join(', ') + ',')
  }
  const ts = `import type { CostSample } from './palette'

// Loss curve captured when PRESET_PALETTE was generated — see the
// regeneration note on PRESET_PALETTE in palette.ts.
export const PRESET_COST_HISTORY: CostSample[] = [
${lines.join('\n')}
]
`
  fs.writeFileSync(new URL('../src/lib/preset-history.ts', import.meta.url), ts)

  console.log(
    JSON.stringify(
      {
        colors: result.colors,
        cost: Number(result.cost.toFixed(4)),
        iterations: result.iterations,
        historyPoints: history.length,
      },
      null,
      2
    )
  )
} finally {
  await server.close()
}

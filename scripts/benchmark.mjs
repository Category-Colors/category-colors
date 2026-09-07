import { createServer } from 'vite'
import { performance } from 'node:perf_hooks'

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
try {
  const { generatePalette } = await server.ssrLoadModule('/src/lib/algorithm.ts')
  const { DEFAULT_PARAMS } = await server.ssrLoadModule('/src/lib/palette.ts')
  const { buildJndReport } = await server.ssrLoadModule('/src/lib/report.ts')
  for (const colorCount of [8, 20]) {
    const samples = []
    for (let run = 0; run < 3; run++) {
      const params = { ...structuredClone(DEFAULT_PARAMS), colorCount }
      const started = performance.now()
      const result = generatePalette(params)
      const generated = performance.now()
      buildJndReport({ ...result, id: 1, createdAt: Date.now(), params })
      samples.push({ generationMs: Math.round(generated - started), reportMs: Math.round(performance.now() - generated) })
    }
    console.log(JSON.stringify({ colorCount, maxIterations: DEFAULT_PARAMS.maxIterations, samples }))
  }
} finally { await server.close() }

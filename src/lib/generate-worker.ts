import { generatePalette } from './algorithm'
import type { GenerateRequest } from './generate'

// Runs the simulated-annealing generation off the main thread; params arrive
// as plain data (ColorValue objects survive structured clone). The request id
// rides along so the caller can tell its own reply from a concurrent one.
self.onmessage = (e: MessageEvent<GenerateRequest>) => {
  const { requestId, ...params } = e.data
  try {
    self.postMessage({ ok: true, requestId, result: generatePalette(params) })
  } catch (err) {
    self.postMessage({ ok: false, requestId, error: String(err) })
  }
}

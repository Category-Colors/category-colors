import type { CostSample, PaletteParams } from './palette'

export interface GenerateResult {
  colors: string[]
  cost: number
  iterations: number
  costHistory: CostSample[]
}

export interface GenerateRequest extends PaletteParams {
  requestId: number
}

type WorkerReply =
  | { ok: true; requestId: number; result: GenerateResult }
  | { ok: false; requestId: number; error: string }

interface PendingRequest {
  resolve: (result: GenerateResult) => void
  reject: (error: Error) => void
}

// One persistent worker and one listener set. It processes messages serially,
// while the request map routes replies and lets a worker-level failure reject
// every queued caller instead of leaving later promises pending forever.
let worker: Worker | null = null
let nextRequestId = 1
const pending = new Map<number, PendingRequest>()

const retireWorker = (error: Error) => {
  worker?.terminate()
  worker = null
  for (const request of pending.values()) request.reject(error)
  pending.clear()
}

const getWorker = () => {
  if (worker) return worker

  const next = new Worker(new URL('./generate-worker.ts', import.meta.url), { type: 'module' })
  next.addEventListener('message', (event: MessageEvent<WorkerReply>) => {
    const request = pending.get(event.data.requestId)
    if (!request) return
    pending.delete(event.data.requestId)
    if (event.data.ok) {
      request.resolve(event.data.result)
    } else {
      // The worker caught an input/algorithm error and is still healthy. Reject
      // only this request so any already-queued runs can finish normally.
      request.reject(new Error(event.data.error))
    }
  })
  next.addEventListener('error', (event) => {
    event.preventDefault()
    retireWorker(event.error instanceof Error ? event.error : new Error(event.message))
  })
  next.addEventListener('messageerror', () => {
    retireWorker(new Error('The generation worker returned an unreadable response.'))
  })
  worker = next
  return next
}

export function generatePaletteAsync(params: PaletteParams): Promise<GenerateResult> {
  return new Promise((resolve, reject) => {
    const requestId = nextRequestId++
    pending.set(requestId, { resolve, reject })
    try {
      getWorker().postMessage({ ...params, requestId } satisfies GenerateRequest)
    } catch (error) {
      pending.delete(requestId)
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

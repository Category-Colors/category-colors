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

// One persistent worker. It processes messages serially, so overlapping
// requests queue rather than run in parallel — the request id is what keeps
// each caller's listener from resolving on someone else's reply.
let worker: Worker | null = null
let nextRequestId = 1

const getWorker = () => {
  worker ??= new Worker(new URL('./generate-worker.ts', import.meta.url), { type: 'module' })
  return worker
}

export function generatePaletteAsync(params: PaletteParams): Promise<GenerateResult> {
  return new Promise((resolve, reject) => {
    const w = getWorker()
    const requestId = nextRequestId++
    const cleanup = () => {
      w.removeEventListener('message', onMessage)
      w.removeEventListener('error', onError)
    }
    // After any failure, retire the worker: a fresh one re-imports current
    // modules on the next run (recovers from e.g. a stale dev-server bundle)
    const retire = () => {
      worker?.terminate()
      worker = null
    }
    const onMessage = (e: MessageEvent<WorkerReply>) => {
      if (e.data.requestId !== requestId) return
      cleanup()
      if (e.data.ok) {
        resolve(e.data.result)
      } else {
        retire()
        reject(new Error(e.data.error))
      }
    }
    // An error event carries no request id — the worker is dead either way,
    // so every in-flight caller is right to reject on it.
    const onError = (e: ErrorEvent) => {
      cleanup()
      retire()
      reject(e.error instanceof Error ? e.error : new Error(e.message))
    }
    w.addEventListener('message', onMessage)
    w.addEventListener('error', onError)
    w.postMessage({ ...params, requestId } satisfies GenerateRequest)
  })
}

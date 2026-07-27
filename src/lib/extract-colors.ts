import { clampRgb, converter, formatHex } from 'culori'

const toOklab = converter('oklab')
const toRgb = converter('rgb')

type Lab = [number, number, number]

const dist = (a: Lab, b: Lab) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)

// Oklab histogram bin width: fine enough that a bin mean is still a color
// that genuinely occurs in the image (no cross-region averaging)
const BIN = 0.04
// Pairwise distinctness floor for picked swatches (~clearly told apart)
const MIN_DELTA_E = 0.08

// Dominant-but-distinct colors from an image: histogram modes in oklab,
// then greedy maximin selection — each pick maximizes distance-to-picked
// weighted by popularity, subject to a minimum pairwise ΔE. Returns fewer
// than `count` when the image doesn't contain that many distinct colors.
export async function extractColors(file: File, count = 8): Promise<string[]> {
  const bitmap = await createImageBitmap(file)
  let data: Uint8ClampedArray
  try {
    const scale = Math.min(1, 80 / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return []
    ctx.drawImage(bitmap, 0, 0, w, h)
    data = ctx.getImageData(0, 0, w, h).data
  } finally {
    // decoded pixel buffers are large; don't wait for GC
    bitmap.close()
  }

  const bins = new Map<string, { sum: Lab; n: number }>()
  let total = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    const { l, a, b } = toOklab({
      mode: 'rgb',
      r: data[i] / 255,
      g: data[i + 1] / 255,
      b: data[i + 2] / 255,
    })
    total += 1
    const key = `${Math.round(l / BIN)},${Math.round(a / BIN)},${Math.round(b / BIN)}`
    const bin = bins.get(key)
    if (bin) {
      bin.sum[0] += l
      bin.sum[1] += a
      bin.sum[2] += b
      bin.n += 1
    } else {
      bins.set(key, { sum: [l, a, b], n: 1 })
    }
  }
  if (total === 0) return []

  // Candidates: bin means with enough pixels behind them to not be noise
  const minCount = Math.max(2, Math.round(total * 0.001))
  const candidates = [...bins.values()]
    .filter((bin) => bin.n >= minCount)
    .map((bin) => ({
      c: [bin.sum[0] / bin.n, bin.sum[1] / bin.n, bin.sum[2] / bin.n] as Lab,
      n: bin.n,
    }))
    .sort((a, b) => b.n - a.n)
  if (candidates.length === 0) return []

  // Most popular color first, then greedy maximin with the ΔE floor
  const picked = [candidates[0]]
  while (picked.length < count) {
    let best: (typeof candidates)[number] | null = null
    let bestScore = 0
    for (const cand of candidates) {
      let dmin = Infinity
      for (const p of picked) dmin = Math.min(dmin, dist(p.c, cand.c))
      if (dmin < MIN_DELTA_E) continue
      const score = dmin * Math.sqrt(cand.n)
      if (score > bestScore) {
        bestScore = score
        best = cand
      }
    }
    if (!best) break // nothing sufficiently different remains
    picked.push(best)
  }

  return picked.map(({ c }) =>
    formatHex(clampRgb(toRgb({ mode: 'oklab', l: c[0], a: c[1], b: c[2] }))).toUpperCase()
  )
}

// Rebuild the brand assets with `node scripts/build-brand.mjs`.
// Two solid Cs side by side. Each is a disc cut by a flat edge just right of
// center and opened by a horizontal slot, so the opening reads as a letter
// rather than a wedge. Every measure is a ratio of the radius.
import { writeFile } from 'node:fs/promises'

const r = 12
const bowl = 0.15 * r // flat edge's offset right of center
const width = r + bowl
const gap = 0.15 * r
const slot = 0.5 * r
const depth = 0.6 * width
const h = Math.sqrt(r * r - bowl * bowl)
const left = 16 - (2 * width + gap) / 2
const n = (v) => +v.toFixed(4)

const paths = [0, 1].map((i) => {
  const flat = n(left + i * (width + gap) + width)
  return `M${flat} ${n(16 - h)}A${r} ${r} 0 1 0 ${flat} ${n(16 + h)}V${16 + slot / 2}H${n(flat - depth)}V${16 - slot / 2}H${flat}Z`
})
const colors = ['#D99B28', '#DB563C']
const shapes = paths.map((d) => `<path d="${d}"/>`).join('\n  ')
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">\n  ${body}\n</svg>\n`

await writeFile(new URL('../src/assets/mark.svg', import.meta.url), svg(shapes))
await writeFile(new URL('../src/assets/mark-color.svg', import.meta.url), svg(
  paths.map((d, index) => `<path fill="${colors[index]}" d="${d}"/>`).join('\n  ')
))
await writeFile(new URL('../public/favicon.svg', import.meta.url), svg(
  `<style>path{fill:#18181b}@media(prefers-color-scheme:dark){path{fill:#fff}}</style>\n  ${shapes}`
))
console.log('Updated monochrome mark, color mark, and adaptive favicon.')

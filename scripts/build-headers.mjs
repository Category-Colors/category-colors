import { readdir, readFile, writeFile } from 'node:fs/promises'

// Apply immutable caching only to assets that exist in this release. A broad
// /assets/* rule also caches missing chunks (or SPA fallback HTML) for a year,
// preventing an open session from recovering after a deployment.
const files = await readdir(new URL('../dist/assets/', import.meta.url))
const base = await readFile(new URL('../public/_headers', import.meta.url), 'utf8')
const rules = files.filter((file) => /\.(js|css|woff2)$/.test(file)).map((file) => `/assets/${file}\n  Cache-Control: public, max-age=31536000, immutable`)
await writeFile(new URL('../dist/_headers', import.meta.url), `${base}\n${rules.join('\n\n')}\n`)

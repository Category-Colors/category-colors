import { DEFAULT_PARAMS, parseParams, type PaletteParams, type PaletteVersion } from './palette'
import { parseCssColor } from './color'

export const SESSION_KEY = 'category-colors:session:v1'
export const MAX_SAVED_VERSIONS = 30
const MAX_BYTES = 2_000_000
export interface Session {
  params: PaletteParams
  versions: PaletteVersion[]
  currentId: number | null
}
export const emptySession = (): Session => ({ params: structuredClone(DEFAULT_PARAMS), versions: [], currentId: null })

export function parseSession(text: string): Session | null {
  if (text.length > MAX_BYTES) return null
  try {
    const raw = JSON.parse(text)
    if (!raw || raw.schema !== 1 || !Array.isArray(raw.versions) || raw.versions.length > MAX_SAVED_VERSIONS) return null
    const params = parseParams(JSON.stringify(raw.params))
    if (!params) return null
    const ids = new Set<number>()
    const versions: PaletteVersion[] = []
    for (const v of raw.versions) {
      if (!v || !Number.isSafeInteger(v.id) || v.id < 1 || ids.has(v.id)) return null
      if (!Array.isArray(v.colors) || v.colors.length > 256 || !v.colors.every((c: unknown) => typeof c === 'string' && c.length < 200 && parseCssColor(c))) return null
      const config = parseParams(JSON.stringify(v.params))
      if (!config || !Number.isFinite(v.cost) || !Number.isSafeInteger(v.iterations) || v.iterations < 0 || !Number.isFinite(v.createdAt)) return null
      if (!Array.isArray(v.costHistory) || v.costHistory.length > 512 || !v.costHistory.every((p: unknown) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) return null
      ids.add(v.id)
      versions.push({ id: v.id, colors: v.colors, params: config, cost: v.cost, iterations: v.iterations, createdAt: v.createdAt, costHistory: v.costHistory, edited: v.edited === true })
    }
    return { params, versions, currentId: ids.has(raw.currentId) ? raw.currentId : versions.at(-1)?.id ?? null }
  } catch {
    return null
  }
}

export function serializeSession(session: Session): string {
  // Keep the active palette even when the user is revisiting an older entry.
  const current = session.versions.find((v) => v.id === session.currentId)
  const recent = session.versions.slice(-MAX_SAVED_VERSIONS)
  if (current && !recent.includes(current)) recent.splice(0, 1, current)
  const versions = recent.map((v) => ({ ...v, costHistory: v.costHistory.length <= 512 ? v.costHistory :
    Array.from({ length: 512 }, (_, i) => v.costHistory[Math.round(i * (v.costHistory.length - 1) / 511)]) }))
  const text = JSON.stringify({ schema: 1, ...session, versions })
  if (text.length > MAX_BYTES) throw new Error('Session too large to save')
  return text
}

export function loadSession(): { session: Session; warning: string | null } {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return { session: emptySession(), warning: null }
    const session = parseSession(raw)
    return { session: session ?? emptySession(), warning: session ? null : 'The saved session could not be restored. Start a new palette or import an export.' }
  } catch {
    return { session: emptySession(), warning: 'Browser storage is unavailable. Download your work before leaving.' }
  }
}

export function saveSession(session: Session): boolean {
  try {
    localStorage.setItem(SESSION_KEY, serializeSession(session))
    return true
  } catch {
    return false
  }
}

import { useCallback, useSyncExternalStore } from 'react'

/**
 * One MediaQueryList per query, kept for the life of the page.
 *
 * Both the subscription and the snapshot read this rather than calling
 * `matchMedia` themselves. A fresh list per snapshot parses the query and
 * allocates twice per render of every consumer — and two of the consumers are
 * charts that re-render on every pointer move across them, which is the one
 * path in this app deliberately kept clear of exactly this kind of per-frame
 * garbage (see the Intl note in chart-geometry.ts).
 */
const lists = new Map<string, MediaQueryList>()

function listFor(query: string) {
  let list = lists.get(query)
  if (!list) lists.set(query, (list = matchMedia(query)))
  return list
}

/**
 * Subscribes to a media query. `useSyncExternalStore` rather than
 * useState + useEffect: the first render already reads the real value, so a
 * layout that differs by breakpoint doesn't paint the wrong one and correct
 * itself a frame later.
 */
function useMediaQuery(query: string) {
  // Both memoised on the query. React compares these by identity each render
  // and, when either has moved, re-reads the snapshot and schedules a passive
  // effect to check the store again — so inline arrows would put that on every
  // render of every consumer rather than only when the query changes.
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = listFor(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query]
  )
  const getSnapshot = useCallback(() => listFor(query).matches, [query])
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => false // SSR/prerender: assume the wide layout
  )
}

/**
 * The phone layout: the docked panels become bottom sheets and the canvas
 * runs edge to edge under a floating toolbar. Mirrors the `max-width: 767px`
 * block in index.css — the two must agree, because the components render
 * different chrome on each side of it.
 */
const PHONE = '(max-width: 767px)'

export const useIsPhone = () => useMediaQuery(PHONE)

/**
 * Wide enough that the canvas can reserve a column per panel, so the docks sit
 * beside the content instead of floating over it. Read once in a state
 * initializer rather than subscribed to (App.tsx) — it decides whether the
 * panels boot open, not how they behave afterwards; it lives here so this file
 * is the one place the app's breakpoints are written down.
 */
export const DOCKED = '(min-width: 1280px)'

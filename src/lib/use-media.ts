import { useCallback, useSyncExternalStore } from 'react'

/**
 * Subscribes to a media query. `useSyncExternalStore` rather than
 * useState + useEffect: the first render already reads the real value, so a
 * layout that differs by breakpoint doesn't paint the wrong one and correct
 * itself a frame later.
 */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query]
  )
  return useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => false // SSR/prerender: assume the wide layout
  )
}

/**
 * The phone layout: the docked panels become bottom sheets and the canvas
 * runs edge to edge under a floating toolbar. Mirrors the `max-width: 767px`
 * block in index.css — the two must agree, because the components render
 * different chrome on each side of it.
 */
export const PHONE = '(max-width: 767px)'

export const useIsPhone = () => useMediaQuery(PHONE)

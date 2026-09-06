import { useState } from 'react'

// Open state for a panel's sections, plus the header control that folds them
// all away or, once every one is closed, brings them all back.
export function useSections<K extends string>(
  keys: readonly K[],
  closed: readonly K[] = [],
  /** The sections actually on screen. Every key still gets state — one that
      comes back later must remember how it was left — but a section nobody can
      see doesn't get a vote on whether everything is collapsed, and the header
      control leaves it alone. */
  visible: readonly K[] = keys
) {
  const [open, setOpen] = useState(
    () => Object.fromEntries(keys.map((k) => [k, !closed.includes(k)])) as Record<K, boolean>
  )
  const allCollapsed = visible.every((k) => !open[k])
  return {
    open,
    setSection: (key: K) => (isOpen: boolean) => setOpen((s) => ({ ...s, [key]: isOpen })),
    allCollapsed,
    toggleAll: () =>
      setOpen((s) => ({ ...s, ...Object.fromEntries(visible.map((k) => [k, allCollapsed])) })),
  }
}

/** "3 colors", "1 evaluator", "No versions" */
export const countOf = (n: number, noun: string) =>
  n === 0 ? `No ${noun}s` : `${n} ${noun}${n === 1 ? '' : 's'}`

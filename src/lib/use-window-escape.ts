import { useEffect, useRef, type RefObject } from 'react'

/**
 * Escape, for the app's non-modal windows (About and the Manual).
 *
 * They can stack, and the key belongs to whichever opened last. Letting each
 * window keep its own capture listener settles that the wrong way round — same
 * target, so order is registration order, and the window that opened *first*
 * takes the key out from under the one drawn on top of it.
 *
 * One listener over a stack instead. It is registered here at module load, not
 * when a window opens, because winning is a matter of being early: the dropdown
 * and sheet handlers listen on document/bubble, so a capture listener already in
 * place beats them however long their popover has been open.
 */
type WindowEntry = {
  el: RefObject<HTMLElement | null>
  close: () => void
}

const stack: WindowEntry[] = []

if (typeof window !== 'undefined') {
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || stack.length === 0) return
      const top = stack[stack.length - 1]
      const active = document.activeElement
      // A window owns Escape while it holds focus, and while nothing does — a
      // click on empty space must not strand it. It does *not* own the key
      // while the work behind it is focused: these windows are non-modal so
      // that the app stays usable underneath, and the app spends Escape on its
      // own layers — a hex field reverting a bad draft, a select dropdown
      // closing, a phone sheet going down. Claiming it unconditionally (which
      // is what a bare capture listener does, and what About used to do alone)
      // swallows every one of those, silently, from anywhere on the page.
      if (active && active !== document.body && !top.el.current?.contains(active)) return
      // Spending the key here is what keeps one press to one layer: without
      // it, dismissing a window also closes a popover left open behind it.
      event.preventDefault()
      event.stopImmediatePropagation()
      top.close()
    },
    true
  )
}

/**
 * Hands focus back to whatever opened this window, on the way out. A non-modal
 * window may have handed it to the page already, so the opener is only restored
 * when focus is still leaving with the window.
 */
export function useWindowFocusReturn(el: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const win = el.current
    return () => {
      if (win?.contains(document.activeElement)) opener?.focus?.({ preventScroll: true })
    }
  }, [el])
}

/**
 * Closes this window on Escape, as long as it is the topmost one and holds the
 * focus. `el` is the window's own element, which is how focus is attributed.
 */
export function useWindowEscape(el: RefObject<HTMLElement | null>, onClose: () => void) {
  const latest = useRef(onClose)
  useEffect(() => {
    latest.current = onClose
  })

  // Registered once for the window's lifetime. Depending on `onClose` instead
  // would pop and re-push on any change of its identity, moving a re-rendered
  // window back to the top of the stack — the exact ordering bug this exists
  // to prevent, and App re-renders on every frame of a slider drag.
  useEffect(() => {
    const entry: WindowEntry = { el, close: () => latest.current() }
    stack.push(entry)
    return () => {
      const i = stack.lastIndexOf(entry)
      if (i !== -1) stack.splice(i, 1)
    }
  }, [el])
}

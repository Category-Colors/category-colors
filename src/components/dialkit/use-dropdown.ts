import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from 'react'
import {
  getDialKitPortalRoot,
  getDropdownPosition,
  type DropdownPosition,
  type DropdownPositionOptions,
} from './dropdown-position'

/**
 * Closes an open overlay on Escape or on a press outside every `inside` ref.
 *
 * `event` picks which press to listen for. 'mousedown' is right for plain
 * menus. 'pointerdown' is right for anything the user drags inside (the color
 * picker): compatibility mouse events can retarget during the rapid
 * pointer-capture cycles a drag produces, which reads as an outside press.
 */
export function useDismiss(
  open: boolean,
  onDismiss: () => void,
  inside: RefObject<Element | null>[],
  { event = 'mousedown' as 'mousedown' | 'pointerdown', escape = true } = {}
) {
  useEffect(() => {
    if (!open) return
    const onDown = (e: Event) => {
      const target = e.target as Node
      if (inside.some((ref) => ref.current?.contains(target))) return
      onDismiss()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener(event, onDown)
    if (escape) document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener(event, onDown)
      if (escape) document.removeEventListener('keydown', onKey)
    }
    // `inside` is a fresh array each render; its refs are stable, so spreading
    // them keeps the effect from re-subscribing on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onDismiss, event, escape, ...inside])
}

/**
 * Marks a dropdown "warm" once the pointer reaches a second option, which the
 * stylesheet uses to drop the per-row hover fade.
 *
 * With every row running its own 100ms fade, sweeping a menu feels like the
 * highlight is chasing the pointer — by the time one row has finished lighting
 * up the pointer is two rows further down. Fading only the first hover keeps
 * the menu from snapping to attention while making every move after it read as
 * instant. Leaving the menu cools it again, so the next visit fades in too.
 */
export function useWarmHover(forward?: RefObject<HTMLDivElement | null>) {
  return useCallback(
    (el: HTMLDivElement | null) => {
      // A dropdown only renders once its measured position lands, a commit
      // after it opens — an effect keyed on `open` would run too early to see
      // it. A ref callback fires exactly when the element exists.
      if (forward) forward.current = el
      if (!el) return
      let last: Element | null = null
      const onOver = (e: PointerEvent) => {
        const option = (e.target as Element).closest('button')
        if (!option || !el.contains(option) || option === last) return
        // set before styles are recomputed for this pointerover, so the row
        // being entered is already exempt from the transition
        if (last) el.setAttribute('data-warm', '')
        last = option
      }
      const cool = () => {
        last = null
        el.removeAttribute('data-warm')
      }
      el.addEventListener('pointerover', onOver)
      el.addEventListener('pointerleave', cool)
      return () => {
        el.removeEventListener('pointerover', onOver)
        el.removeEventListener('pointerleave', cool)
        if (forward) forward.current = null
      }
    },
    [forward]
  )
}

/**
 * Resolves the DialKit portal root once, then measures an anchored position
 * each time the overlay opens. Returns null for `pos` until measured, which is
 * also the signal not to render yet — an unmeasured dropdown would flash at
 * the origin.
 *
 * `anchor` overrides what the position is measured against (an empty-state
 * slot rather than the small ghost button inside it).
 */
export function useAnchoredPortal(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  options: DropdownPositionOptions & { anchor?: () => HTMLElement | null } = {}
) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const [pos, setPos] = useState<DropdownPosition | null>(null)
  const { dropdownHeight, gap, allowAbove, anchor } = options

  useLayoutEffect(() => {
    setPortalTarget(getDialKitPortalRoot(triggerRef.current) ?? document.body)
  }, [triggerRef])

  useLayoutEffect(() => {
    const el = anchor?.() ?? triggerRef.current
    if (!open || !el || !portalTarget) {
      setPos(null)
      return
    }

    const measure = () => {
      setPos(getDropdownPosition(el, portalTarget, { dropdownHeight, gap, allowAbove }))
    }
    measure()

    // Panel content can scroll beneath an open portaled dropdown. Keep its
    // anchor attached, and remeasure when the viewport changes. Collapse bursts
    // of scroll events into one layout read per frame.
    let frame = 0
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    window.addEventListener('resize', scheduleMeasure)
    window.addEventListener('scroll', scheduleMeasure, { passive: true, capture: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', scheduleMeasure)
      window.removeEventListener('scroll', scheduleMeasure, true)
    }
    // `anchor` is typically an inline closure; it's read only at open time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, portalTarget, triggerRef, dropdownHeight, gap, allowAbove])

  return { portalTarget, pos }
}

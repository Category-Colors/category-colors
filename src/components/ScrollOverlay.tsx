import { useEffect, useRef, type RefObject } from 'react'

const MIN_THUMB = 18

/**
 * A scrollbar that always floats over the content, whatever the OS is set to.
 *
 * Overlay scrollbars are the platform's choice, not the page's: with macOS
 * "Show scroll bars: Always" (the default once a mouse is attached) the native
 * bar becomes a classic one that reserves a ~15px gutter and narrows the text.
 * Styling `::-webkit-scrollbar` can't fix that — giving a scrollbar custom
 * styles is precisely what makes Blink drop overlay mode. So the native bar is
 * hidden and this draws the thumb instead.
 *
 * The thumb is positioned imperatively: scrolling must not re-render React.
 * Mount it inside a positioned ancestor of the scroller.
 */
export function ScrollOverlay({
  scrollerRef,
  /** re-measure when the scrolled content changes (its box may not) */
  watch,
}: {
  scrollerRef: RefObject<HTMLElement | null>
  watch?: unknown
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollerRef.current
    const track = trackRef.current
    const thumb = thumbRef.current
    if (!el || !track || !thumb) return

    let thumbH = 0
    let range = 0

    const sync = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      const overflow = scrollHeight - clientHeight
      // +1 absorbs sub-pixel rounding, which would otherwise show a
      // full-height thumb on content that doesn't actually scroll
      if (overflow <= 1) {
        track.dataset.scrollable = 'false'
        return
      }
      track.dataset.scrollable = 'true'
      const trackH = track.clientHeight
      thumbH = Math.max(MIN_THUMB, (clientHeight / scrollHeight) * trackH)
      range = trackH - thumbH
      thumb.style.height = `${thumbH}px`
      thumb.style.transform = `translateY(${(scrollTop / overflow) * range}px)`
    }

    sync()
    el.addEventListener('scroll', sync, { passive: true })
    const ro = new ResizeObserver(sync)
    ro.observe(el)

    // Drag the thumb: map pointer travel across the free track back onto the
    // scrollable overflow.
    let startY = 0
    let startScroll = 0
    const onMove = (e: PointerEvent) => {
      if (range <= 0) return
      const overflow = el.scrollHeight - el.clientHeight
      el.scrollTop = startScroll + ((e.clientY - startY) / range) * overflow
    }
    const onUp = (e: PointerEvent) => {
      thumb.removeAttribute('data-dragging')
      thumb.releasePointerCapture(e.pointerId)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      startY = e.clientY
      startScroll = el.scrollTop
      thumb.dataset.dragging = 'true'
      thumb.setPointerCapture(e.pointerId)
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }
    thumb.addEventListener('pointerdown', onDown)

    return () => {
      el.removeEventListener('scroll', sync)
      ro.disconnect()
      thumb.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [scrollerRef, watch])

  return (
    <div ref={trackRef} className="scroll-overlay" data-scrollable="false" aria-hidden>
      <div ref={thumbRef} className="scroll-overlay-thumb" />
    </div>
  )
}

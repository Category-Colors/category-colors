import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react'
import { SPRING, prefersReducedMotion } from '@/components/dialkit'

// Detents, as fractions of the visual viewport.
//
// Medium is the working height: enough of the panel to edit in, and the
// canvas still showing above it. That matters more here than in most apps —
// the whole point of this one is watching a palette land on real charts, so
// half a screen of dashboard behind the sheet is not wasted space, it's the
// feedback loop. Large is a full read of the panel, 8% short of the top so
// the canvas never disappears entirely.
const MEDIUM = 0.54
const LARGE = 0.92
// …but a fraction of a short screen is a short sheet, and the panel needs a
// certain absolute height before it holds anything: a header, a control or
// two, and the footer button. Below roughly an iPhone SE this floor is what
// medium resolves to.
const MEDIUM_FLOOR = 360
// Released shorter than this fraction of the medium detent, the sheet leaves
// rather than snapping back — a short flick down should dismiss.
const DISMISS = 0.74
// How far the drag's velocity is allowed to carry the sheet past the finger.
// 0.15s of travel: enough that a fling reaches the next detent, short enough
// that a slow drag lands where it was let go.
const PROJECT = 0.15
// Above the large detent the sheet still follows the finger, at a quarter
// speed — the resistance is what says there's nothing above this.
const RUBBER = 0.25

/**
 * A bottom sheet with two detents, dragged by its handle.
 *
 * Drags drive the sheet's `height` rather than translating it, so the header
 * stays on the top edge and the panel's own sticky footer stays on the bottom
 * one at every detent — the Generate button is reachable from the medium
 * detent without expanding first. The finger keeps hold of the grabber either
 * way, since the grabber rides the top edge that the drag is moving.
 *
 * Entering and leaving is a translate (`y: '100%'`, the sheet's own height),
 * which is a compositor transform and doesn't relayout the panel inside.
 */
export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean
  onClose: () => void
  /** Names the dialog for screen readers */
  label: string
  children: ReactNode
}) {
  return (
    <AnimatePresence>
      {open && (
        <SheetBody onClose={onClose} label={label}>
          {children}
        </SheetBody>
      )}
    </AnimatePresence>
  )
}

function SheetBody({
  onClose,
  label,
  children,
}: {
  onClose: () => void
  label: string
  children: ReactNode
}) {
  // innerHeight, not 100dvh: the drag maths needs a number, and this is the
  // one the browser measures the visual viewport by.
  const [vh, setVh] = useState(() => window.innerHeight)
  const large = vh * LARGE
  const medium = Math.min(large, Math.max(vh * MEDIUM, MEDIUM_FLOOR))
  const height = useMotionValue(medium)
  // The scrim only exists between the detents: at medium the canvas behind is
  // live and scrollable — you can adjust a colour and then scroll the charts
  // to see it — and it dims and starts catching taps as the sheet claims the
  // screen.
  const scrimOpacity = useTransform(height, [medium, large], [0, 0.4])
  const scrimEvents = useTransform(height, (h) => (h > (medium + large) / 2 ? 'auto' : 'none'))
  const drag = useRef<{ y: number; height: number; v: number; lastY: number; lastT: number }>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Move focus into the sheet on open and hand it back on close. Not a focus
  // trap: at the medium detent the canvas behind is genuinely still in play,
  // so tabbing out of the sheet is allowed to reach it.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    sheetRef.current?.focus({ preventScroll: true })
    return () => opener?.focus?.({ preventScroll: true })
  }, [])

  // Keep the sheet on its detent when the viewport changes under it (rotation,
  // the URL bar collapsing). Snapping to whichever detent it was nearer beats
  // scaling the raw height, which would leave it between the two.
  useEffect(() => {
    const h = height.get()
    height.set(h > (medium + large) / 2 ? large : medium)
    // the detents are derived from vh, and re-running on every render would
    // fight a drag in progress
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vh])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onPointerDown = (e: ReactPointerEvent) => {
    // Only the handle drags, so a slider or a reorder row inside the panel
    // never has to compete with the sheet for the same gesture.
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {
      y: e.clientY,
      height: height.get(),
      v: 0,
      lastY: e.clientY,
      lastT: e.timeStamp,
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const raw = d.height + (d.y - e.clientY)
    height.set(
      raw > large
        ? large + (raw - large) * RUBBER
        : // a floor rather than translating away: below it the sheet is a
          // header over a footer and there is nothing left to show
          Math.max(raw, medium * 0.4)
    )
    const dt = e.timeStamp - d.lastT
    if (dt > 0) d.v = ((d.lastY - e.clientY) / dt) * 1000
    d.lastY = e.clientY
    d.lastT = e.timeStamp
  }

  const onPointerUp = () => {
    const d = drag.current
    if (!d) return
    drag.current = null
    const projected = height.get() + d.v * PROJECT
    if (projected < medium * DISMISS) {
      onClose()
      return
    }
    animate(
      height,
      projected > (medium + large) / 2 ? large : medium,
      prefersReducedMotion() ? { duration: 0 } : SPRING.detent
    )
  }

  const transition = prefersReducedMotion() ? { duration: 0 } : SPRING.sheetIn

  return (
    <>
      <motion.div
        className="sheet-scrim"
        style={{ opacity: scrimOpacity, pointerEvents: scrimEvents }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        ref={sheetRef}
        className="sheet dialkit-root"
        role="dialog"
        aria-label={label}
        tabIndex={-1}
        style={{ height }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%', transition: prefersReducedMotion() ? { duration: 0 } : SPRING.sheetOut }}
        transition={transition}
      >
        <div
          className="sheet-handle"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="sheet-grabber" />
        </div>
        <div className="sheet-body">{children}</div>
      </motion.div>
    </>
  )
}

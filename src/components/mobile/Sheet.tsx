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
// How dark the page behind gets once the sheet is all the way up.
const SCRIM = 0.4
// A flick that ends in a pause is a release at rest, not a fling. Past this
// many milliseconds without a pointermove, the last measured velocity is stale
// and gets dropped rather than projected.
const STALE_MS = 90

/** Where the two detents sit for a given viewport height. */
const detentsFor = (vh: number) => {
  const large = vh * LARGE
  return { large, medium: Math.min(large, Math.max(vh * MEDIUM, MEDIUM_FLOOR)) }
}

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
  const { medium, large } = detentsFor(vh)
  const mid = (medium + large) / 2
  const height = useMotionValue(medium)
  // The scrim only exists between the detents: at medium the canvas behind is
  // live and scrollable — you can adjust a colour and then scroll the charts
  // to see it — and it dims and starts catching taps as the sheet claims the
  // screen.
  //
  // A function rather than an input/output range, because on a viewport short
  // enough that MEDIUM_FLOOR swallows the gap (landscape on a small phone) the
  // two detents coincide. A range would interpolate across zero width, hand
  // back NaN, and — since the browser drops `opacity: NaN` — leave this solid
  // black box sitting over the screen at full strength. With one detent there
  // is nothing to interpolate and the sheet is always "large", so the scrim is
  // simply up.
  const spread = large - medium
  const scrimOpacity = useTransform(height, (h) =>
    spread > 0 ? Math.max(0, Math.min(1, (h - medium) / spread)) * SCRIM : SCRIM
  )
  const scrimEvents = useTransform(height, (h) => (spread > 0 && h <= mid ? 'none' : 'auto'))
  const drag = useRef<{ y: number; height: number; v: number; lastY: number; lastT: number }>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  // One handler for one event. The sheet also has to come back to a detent
  // when the viewport changes under it (rotation, the URL bar collapsing) —
  // snapping to whichever it was nearer, rather than scaling the raw height,
  // which would leave it stranded between the two.
  useEffect(() => {
    const onResize = () => {
      const next = window.innerHeight
      setVh(next)
      const d = detentsFor(next)
      height.set(height.get() > (d.medium + d.large) / 2 ? d.large : d.medium)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [height])

  // Move focus into the sheet on open and hand it back on close. Not a focus
  // trap: at the medium detent the canvas behind is genuinely still in play,
  // so tabbing out of the sheet is allowed to reach it.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    sheetRef.current?.focus({ preventScroll: true })
    return () => opener?.focus?.({ preventScroll: true })
  }, [])

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

  const onPointerUp = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    drag.current = null
    // `d.v` was last measured on a pointermove; a finger that flicks and then
    // holds still emits no more of those, so without this a sheet released at
    // rest would fly to the next detent — or dismiss — on a velocity from half
    // a second ago.
    const velocity = e.timeStamp - d.lastT > STALE_MS ? 0 : d.v
    const projected = height.get() + velocity * PROJECT
    if (projected < medium * DISMISS) {
      onClose()
      return
    }
    // The one place here that has to ask. MotionConfig's reducedMotion covers
    // motion's own props — the y above — but not a standalone animate() call,
    // exactly as MorphPanel's width animation has to ask for itself.
    animate(
      height,
      projected > mid ? large : medium,
      prefersReducedMotion() ? { duration: 0 } : SPRING.detent
    )
  }

  return (
    // The layer, not the sheet, is the .dialkit-root. DialKit's dropdowns
    // portal into the nearest one and position themselves against its box
    // (dropdown-position.ts) — and the sheet is `overflow: hidden` and carries
    // a transform, so a color picker or a select opened near its bottom edge
    // would be measured against a moving box and then clipped away by it. A
    // full-viewport layer is neither, and it still hands the sheet the theme
    // tokens its glass is made of. Transparent to the pointer, so the canvas
    // behind an unscrimmed sheet stays live; each child takes its own back.
    <div className="sheet-layer dialkit-root">
      <motion.div
        className="sheet-scrim"
        style={{ opacity: scrimOpacity, pointerEvents: scrimEvents }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-label={label}
        tabIndex={-1}
        style={{ height }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%', transition: SPRING.sheetOut }}
        transition={SPRING.sheetIn}
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
    </div>
  )
}

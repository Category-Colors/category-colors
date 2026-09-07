import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { motion, animate, AnimatePresence } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { SPRING, prefersReducedMotion } from '@/components/dialkit'
import { ICON_STROKE } from '@/components/panels/icons'

export const PANEL_WIDTH = 292
export const PUCK_SIZE = 42

// Tabler layout-sidebar-collapse glyph; the frame stays put while the chevron
// morphs between pointing toward the panel's edge (collapse) and away from
// it (expand).
// The divider ends inside the frame's stroke, so the two ride in one <path> —
// one element is one rasterized stroke region, and translucent ink can't
// double the junction (see panels/icons.tsx). The chevron touches neither, so
// it stays its own element and keeps animating its own d.
const FRAME = 'M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12'

function SidebarToggleIcon({ side, minimized }: { side: 'left' | 'right'; minimized: boolean }) {
  const divider = side === 'left' ? 'M9 4v16' : 'M15 4v16'
  const collapse = side === 'left' ? 'M15 10l-2 2l2 2' : 'M9 10l2 2l-2 2'
  const expand = side === 'left' ? 'M13 10l2 2l-2 2' : 'M11 10l-2 2l2 2'
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ICON_STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d={FRAME + divider} />
      <motion.path
        initial={false}
        animate={{ d: minimized ? expand : collapse }}
        transition={SPRING.glyph}
      />
    </svg>
  )
}

// Docked glass panel that morphs into a bare 42px toggle when minimized.
// The toggle is persistent — the container morphs around it.
export function MorphPanel({
  side,
  name,
  minimized,
  onMinimizedChange,
  hoverToOpen = false,
  width,
  children,
}: {
  side: 'left' | 'right'
  /** The panel's own title, lowercased into the footprint's invitation */
  name: string
  minimized: boolean
  onMinimizedChange: (minimized: boolean) => void
  /** First run: while collapsed, the panel's whole footprint is outlined,
      lights up on hover, and opens the panel on click */
  hoverToOpen?: boolean
  /** The panel's live width. Owned by the app so the nav row can move with
      it: both read the same number each frame, so nothing has to approximate
      the spring. */
  width: MotionValue<number>
  children: ReactNode
}) {
  const morphRef = useRef<HTMLDivElement>(null)
  const pinnedHeight = useRef(600)

  // Driven imperatively rather than through `animate` so the value is the
  // shared motion value itself. Outside MotionConfig, so reduced motion is
  // checked by hand.
  useEffect(() => {
    animate(
      width,
      minimized ? PUCK_SIZE : PANEL_WIDTH,
      prefersReducedMotion() ? { duration: 0 } : minimized ? SPRING.morphOut : SPRING.morphIn
    )
  }, [width, minimized])

  // Capture the rendered height before collapsing; the collapse animates
  // height via explicit [from, to] keyframes because springing from 'auto'
  // snaps instead of interpolating.
  const minimize = () => {
    if (morphRef.current) pinnedHeight.current = morphRef.current.offsetHeight
    onMinimizedChange(true)
  }

  return (
    <aside className={`dialkit-root panel-dock panel-dock-${side}`}>
      {/* before the morph in the DOM so the puck stays on top of it */}
      {minimized && hoverToOpen && (
        <button
          type="button"
          className="panel-hover-zone"
          onClick={() => onMinimizedChange(false)}
        >
          {/* names the target rather than the gesture: the outline already
              reads as a place, this says which one. Carried in the a11y tree
              at all times — only its ink waits for the hover. */}
          <span>Open {name.toLowerCase()} panel</span>
        </button>
      )}
      <motion.div
        ref={morphRef}
        className="panel-morph"
        data-min={minimized ? '' : undefined}
        initial={false}
        style={{ width }}
        animate={{ height: minimized ? [pinnedHeight.current, PUCK_SIZE] : 'auto' }}
        transition={minimized ? SPRING.morphOut : SPRING.morphIn}
        onClick={minimized ? () => onMinimizedChange(false) : undefined}
      >
        <motion.button
          className="panel-toggle"
          aria-label={minimized ? 'Expand panel' : 'Minimize panel'}
          onClick={(e) => {
            e.stopPropagation()
            if (minimized) onMinimizedChange(false)
            else minimize()
          }}
          // the 2px inset shift rides the container morph as a transform;
          // animating `right` relayouts the panel on every frame of it. A raw
          // transform string is invisible to MotionConfig's reducedMotion, so
          // the shift lands instantly there rather than gliding.
          animate={{ transform: `translateX(${minimized ? 2 : 0}px)` }}
          transition={
            prefersReducedMotion()
              ? { duration: 0 }
              : minimized
                ? SPRING.morphOut
                : SPRING.morphIn
          }
          // carries the inset shift, or the tap would snap it back 2px
          whileTap={{ transform: `translateX(${minimized ? 2 : 0}px) scale(0.97)` }}
        >
          <SidebarToggleIcon side={side} minimized={minimized} />
        </motion.button>
        <AnimatePresence mode="popLayout" initial={false}>
          {!minimized && (
            <motion.div
              key="panel"
              className="panel-morph-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.15, delay: 0.06 } }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </aside>
  )
}

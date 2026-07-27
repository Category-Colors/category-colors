import { useRef } from 'react'
import type { ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { SPRING } from '@/components/dialkit'

// Tabler layout-sidebar-collapse glyph; the frame stays put while the chevron
// morphs between pointing toward the panel's edge (collapse) and away from
// it (expand).
function SidebarToggleIcon({ side, minimized }: { side: 'left' | 'right'; minimized: boolean }) {
  const divider = side === 'left' ? 'M9 4v16' : 'M15 4v16'
  const collapse = side === 'left' ? 'M15 10l-2 2l2 2' : 'M9 10l2 2l-2 2'
  const expand = side === 'left' ? 'M13 10l2 2l-2 2' : 'M11 10l-2 2l2 2'
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" />
      <path d={divider} />
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
  minimized,
  onMinimizedChange,
  children,
}: {
  side: 'left' | 'right'
  minimized: boolean
  onMinimizedChange: (minimized: boolean) => void
  children: ReactNode
}) {
  const morphRef = useRef<HTMLDivElement>(null)
  const pinnedHeight = useRef(600)

  // Capture the rendered height before collapsing; the collapse animates
  // height via explicit [from, to] keyframes because springing from 'auto'
  // snaps instead of interpolating.
  const minimize = () => {
    if (morphRef.current) pinnedHeight.current = morphRef.current.offsetHeight
    onMinimizedChange(true)
  }

  return (
    <aside className={`dialkit-root panel-dock panel-dock-${side}`}>
      <motion.div
        ref={morphRef}
        className="panel-morph"
        data-min={minimized ? '' : undefined}
        initial={false}
        animate={
          minimized
            ? { width: 42, height: [pinnedHeight.current, 42] }
            : { width: 292, height: 'auto' }
        }
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
          animate={{ right: minimized ? 6 : 8 }}
          transition={{ right: minimized ? SPRING.morphOut : SPRING.morphIn }}
          whileTap={{ scale: 0.9 }}
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
              <div className="dialkit-panel" data-mode="inline">
                <div className="dialkit-panel-inner">{children}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </aside>
  )
}

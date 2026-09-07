import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { windowMotion } from '@/components/dialkit'
import { useWindowEscape, useWindowFocusReturn } from '@/lib/use-window-escape'
import { XIcon } from '@/components/panels/icons'

function SplashArtwork() {
  return (
    <div className="about-artwork" aria-hidden="true">
      <div className="about-artwork-field">
        <span className="about-sun" />
        <span className="about-beam about-beam-a" />
        <span className="about-beam about-beam-b" />
        <span className="about-beam about-beam-c" />
        <span className="about-orbit about-orbit-outer" />
        <span className="about-orbit about-orbit-middle" />
        <span className="about-orbit about-orbit-inner" />
        <span className="about-pupil" />
        <span className="about-satellite about-satellite-a" />
        <span className="about-satellite about-satellite-b" />
        <span className="about-satellite about-satellite-c" />
        <span className="about-artwork-index">01—08</span>
      </div>
      <div className="about-title-panel">
        <span className="about-mini-mark">
          <span />
        </span>
        <div className="about-title-lockup">
          <p>Category</p>
          <p>colors</p>
        </div>
        <p className="about-version">Version 1.1</p>
        <p className="about-title-note">Perceptual palette system</p>
      </div>
    </div>
  )
}

function AboutSplash({ onClose }: { onClose: () => void }) {
  const layerRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()

  useWindowEscape(dialogRef, onClose)
  useWindowFocusReturn(dialogRef)

  // Nothing inside is worth landing on, so the window itself takes focus —
  // which is also what makes Escape reach it.
  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true })
  }, [])

  return createPortal(
    <motion.div ref={layerRef} className="window-layer">
      <motion.div
        ref={dialogRef}
        className="about-dialog window-surface"
        role="dialog"
        aria-labelledby="about-title"
        aria-describedby="about-description"
        tabIndex={-1}
        {...windowMotion()}
        dragControls={dragControls}
        dragConstraints={layerRef}
      >
        <div
          className="window-bar"
          onPointerDown={(event) => {
            event.preventDefault()
            dragControls.start(event)
          }}
        >
          <span className="window-title">About</span>
          <button
            type="button"
            className="window-close"
            aria-label="Close About window"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClose}
          >
            <XIcon />
          </button>
        </div>

        <div className="about-window-content">
          <SplashArtwork />

          <div className="about-colophon">
            <div className="about-colophon-lead">
              <p id="about-title">Category colors</p>
              <p id="about-description">
                A browser-based palette optimizer for colors that belong together
                without disappearing into one another.
              </p>
            </div>
            <div className="about-colophon-details">
              <p>
                SIMULATED ANNEALING<br />
                PERCEPTUAL COLOR SPACES<br />
                COLOR VISION SIMULATION
              </p>
              <p>
                BUILT FOR THE WEB<br />
                WITH CATEGORY-COLORS<br />
                RELEASE 1.1
              </p>
            </div>
            <div className="about-colophon-foot">
              <p>© 2026 CATEGORY COLORS</p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <AnimatePresence>{open && <AboutSplash onClose={onClose} />}</AnimatePresence>
}

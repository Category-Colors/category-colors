import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { SPRING } from '@/components/dialkit'

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="m4 4 8 8m0-8-8 8" />
    </svg>
  )
}

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

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    dialog?.focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // This window can sit over a phone sheet. Capture Escape before that
        // sheet's listener sees it, so one press dismisses one layer.
        event.preventDefault()
        event.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)

    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      // A non-modal window may have handed focus back to the page already.
      // Restore its opener only when focus is still leaving with the window.
      if (dialog?.contains(document.activeElement)) {
        opener?.focus?.({ preventScroll: true })
      }
    }
  }, [onClose])

  return createPortal(
    <motion.div ref={layerRef} className="about-layer">
      <motion.div
        ref={dialogRef}
        className="about-dialog"
        role="dialog"
        aria-labelledby="about-title"
        aria-describedby="about-description"
        tabIndex={-1}
        drag
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={layerRef}
        dragElastic={0}
        dragMomentum={false}
        initial={{ opacity: 0, y: 12, scale: 0.965 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.98, transition: SPRING.morphOut }}
        transition={SPRING.morphIn}
      >
        <div
          className="about-window-bar"
          onPointerDown={(event) => {
            event.preventDefault()
            dragControls.start(event)
          }}
        >
          <span className="about-window-title">About</span>
          <button
            type="button"
            className="about-close"
            aria-label="Close About window"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClose}
          >
            <CloseIcon />
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

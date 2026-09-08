import { Fragment, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { windowMotion } from '@/components/dialkit'
import { useWindowEscape, useWindowFocusReturn } from '@/lib/use-window-escape'
import { XIcon } from '@/components/panels/icons'

// The people whose research, palettes, tools and libraries this app is built
// out of — the acknowledgements from the essay, plus DialKit, whose controls
// are vendored in src/components/dialkit. First-name alphabetical, the order
// credit blocks have used since they were printed on paper. A missing `url` is
// a name with no page of their own to point at, not an oversight.
const THANKS: { name: string; url?: string }[] = [
  { name: 'Andrew McNutt', url: 'https://www.mcnutt.in/' },
  { name: 'Arran Zeyu Wang', url: 'https://arranzeyuwang.github.io/' },
  { name: 'Chin Tseng', url: 'https://www.chintseng.com/' },
  { name: 'Connor Gramazio', url: 'https://gramaz.io/' },
  { name: 'Cynthia Brewer', url: 'https://sites.psu.edu/cbrewer/' },
  { name: 'Dan Burzo', url: 'https://danburzo.ro/' },
  { name: 'Danielle Albers Szafir', url: 'https://danielleszafir.com/' },
  { name: 'David Laidlaw', url: 'https://cs.brown.edu/people/dhl/' },
  { name: 'Edul Dalal' },
  { name: 'Gaurav Sharma', url: 'https://labsites.rochester.edu/gsharma/' },
  { name: 'Ghulam Jilani Quadri', url: 'https://www.jiquadcs.com/' },
  { name: 'Gustavo Machado' },
  { name: 'Jeffrey Heer', url: 'https://homes.cs.washington.edu/~jheer/' },
  { name: 'Johan Larsson', url: 'https://jolars.co/' },
  { name: 'Josh Puckett', url: 'https://joshpuckett.me/' },
  { name: 'Karen Schloss', url: 'https://schlosslab.discovery.wisc.edu/' },
  { name: 'Kecheng Lu' },
  { name: 'Kei Ito', url: 'https://jfly.uni-koeln.de/color/' },
  { name: 'Leandro Fernandes', url: 'https://profs.ic.uff.br/~laffernandes/' },
  { name: 'Manuel Oliveira', url: 'https://www.inf.ufrgs.br/~oliveira/' },
  { name: 'Mark Harrower' },
  { name: 'Masataka Okabe', url: 'https://jfly.uni-koeln.de/color/' },
  { name: 'Matthew Petroff', url: 'https://mpetroff.net/' },
  { name: 'Maureen Stone', url: 'https://mcstone.github.io/' },
  { name: 'Vidya Setlur', url: 'https://www.vidyasetlur.com/' },
  { name: 'Wencheng Wu' },
]

function ThanksTo() {
  return (
    <section className="about-thanks">
      <p className="about-thanks-label">With thanks to</p>
      {/* One flowing block rather than a list: the separators are punctuation
          in a paragraph of credits, so they stay in the text and out of the
          accessibility tree's way. */}
      <p className="about-thanks-names">
        {THANKS.map(({ name, url }, index) => (
          <Fragment key={name}>
            {/* the only break opportunity between names: each name carries its
                own comma inside a nowrap span, so no one gets split in half */}
            {index > 0 && ' '}
            <span className="about-thanks-name">
              {url ? (
                // New tab, because the palette in the app behind this window is
                // unsaved work — following a credit shouldn't cost it.
                <a href={url} target="_blank" rel="noreferrer">
                  {name}
                </a>
              ) : (
                name
              )}
              {index < THANKS.length - 1 && ','}
            </span>
          </Fragment>
        ))}
      </p>
    </section>
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
                A browser-based optimizer for categorical color palettes.
              </p>
            </div>
            <ThanksTo />
            <div className="about-colophon-foot">
              <p>© 2026 by Matt Ström-Awn</p>
              <p className="about-colophon-links">
                <a href="https://github.com/ilikescience/category-colors" target="_blank" rel="noreferrer">
                  category-colors on GitHub
                </a>
                <a href="https://x.com/mattstromawn" target="_blank" rel="noreferrer">
                  @mattstromawn
                </a>
              </p>
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

import { AnimatePresence, motion } from 'motion/react'
import { SPRING, prefersReducedMotion } from '@/components/dialkit'

export type MobileSheet = 'config' | 'output'

// Tabler adjustments-horizontal: three tracks with their handles offset, which
// is the panel it opens in miniature.
function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h9M17 6h3" />
      <path d="M4 12h4M12 12h8" />
      <path d="M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  )
}

// A play triangle: what this button starts is a run — the annealer, for as
// long as it takes — and the spinner it turns into is the same idea carried
// on. Filled, with the corners rounded by a stroke of its own colour rather
// than by a longer path. Nudged right of the geometric centre, because a
// right-pointing triangle centred by its bounding box reads as sitting left.
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
      <path d="M7.5 5.5v13l10.5 -6.5z" />
    </svg>
  )
}

// Tabler palette. The panel behind it is where the colors are read out, edited
// and taken away; a painter's palette says "the colors themselves" at 21px,
// where a download tray would promise a file the tap doesn't hand over and a
// stack of swatches turns to mud. The dots are filled rather than stroked —
// three hairline rings this small close up into blobs.
function PaletteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25" />
      <circle cx="8.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * The phone's control surface: three islands of the same glass, one per step
 * of the app's own loop — configure on the left, generate in the middle,
 * output on the right. Separating them puts the primary action under the
 * thumb's natural resting point and reads the order the work happens in,
 * which a segmented pill of three would flatten into a set of tabs.
 *
 * Icon-only. Each one either opens a panel you can look at or does something
 * whose result is immediate, so a label would be a caption on a door rather
 * than a warning about what's behind it. The one exception is the primary
 * action while it runs: the button stretches to name the stage of the anneal
 * going by, because that is the only state here you can't see at a glance.
 *
 * The row ducks out of the way when a sheet takes over — the sheet carries its
 * own footer action, so leaving this up would put two Generate buttons on
 * screen.
 */
export function MobileBar({
  busy,
  busyLabel,
  open,
  onOpen,
  onGenerate,
  hidden,
}: {
  busy: boolean
  /** The generate button's cycling verb, shared with the panel's own button */
  busyLabel: string
  open: MobileSheet | null
  onOpen: (sheet: MobileSheet) => void
  onGenerate: () => void
  hidden: boolean
}) {
  const spring = prefersReducedMotion() ? { duration: 0 } : SPRING.toolbar
  return (
    <motion.div
      className="mobile-bar dialkit-root"
      initial={false}
      animate={{ y: hidden ? '160%' : '0%', opacity: hidden ? 0 : 1 }}
      transition={spring}
      // hidden means a sheet owns the screen; nothing here should be tabbable
      // behind it
      inert={hidden || undefined}
    >
      <button
        type="button"
        className="mobile-bar-button"
        data-active={open === 'config' ? '' : undefined}
        aria-label="Configuration"
        aria-haspopup="dialog"
        aria-expanded={open === 'config'}
        onClick={() => onOpen('config')}
      >
        <SlidersIcon />
      </button>

      <motion.button
        layout
        transition={spring}
        type="button"
        className="mobile-bar-generate"
        data-busy={busy ? '' : undefined}
        aria-label="Generate a palette"
        onClick={() => {
          if (!busy) onGenerate()
        }}
      >
        {busy ? <span className="button-spinner" /> : <PlayIcon />}
        <AnimatePresence initial={false}>
          {busy && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              {busyLabel}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <button
        type="button"
        className="mobile-bar-button"
        data-active={open === 'output' ? '' : undefined}
        aria-label="Output"
        aria-haspopup="dialog"
        aria-expanded={open === 'output'}
        onClick={() => onOpen('output')}
      >
        <PaletteIcon />
      </button>
    </motion.div>
  )
}

import type { Transition } from 'motion/react'

// Animation tokens — every motion/react transition in the app comes from here.
// CSS-side durations are mirrored in theme.css as --dial-anim-fast (hover and
// press feedback) and --dial-anim-reveal (opacity reveals, pill slides).
export const SPRING = {
  /** Folder/panel content expanding and collapsing; rubber-band settles */
  expand: { type: 'spring', visualDuration: 0.24, bounce: 0.08 },
  /** Dropdowns and popovers entering/leaving */
  pop: { type: 'spring', visualDuration: 0.12, bounce: 0 },
  /** Small glyph moves: chevron rotations, slider-handle morphs */
  glyph: { type: 'spring', visualDuration: 0.15, bounce: 0.1 },
  /** Press feedback on tappable chrome */
  tap: { type: 'spring', visualDuration: 0.12, bounce: 0.25 },
  /** Value snapping to a clicked position */
  snap: { type: 'spring', stiffness: 380, damping: 26, mass: 0.7 },
  /** Container dismissals (panel → button) — quick exit, no flourish */
  morphOut: { type: 'spring', visualDuration: 0.12, bounce: 0.02 },
  /** Container arrivals (button → panel) — slightly longer, gently physical */
  morphIn: { type: 'spring', visualDuration: 0.24, bounce: 0.15 },
} as const satisfies Record<string, Transition>

/** Plain opacity fade for elements that shouldn't spring */
export const FADE: Transition = { duration: 0.12 }

/** Segmented-control pill slide (CSS transition string; element must sit inside .dialkit-root) */
export const PILL_TRANSITION =
  'left var(--dial-anim-reveal) cubic-bezier(0.25, 1, 0.5, 1), width var(--dial-anim-reveal) cubic-bezier(0.25, 1, 0.5, 1)'

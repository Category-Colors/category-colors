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
  /** A bottom sheet rising from the screen edge. Longer than the panel morph
      and with less bounce: it travels most of a phone's height, where the same
      overshoot that reads as lively over 250px reads as loose over 800. */
  sheetIn: { type: 'spring', visualDuration: 0.34, bounce: 0.1 },
  /** …and leaving. Dismissals get out of the way; nothing to admire. */
  sheetOut: { type: 'spring', visualDuration: 0.2, bounce: 0 },
  /** A sheet settling onto a detent after a drag. Carries a little bounce so
      the snap reads as the sheet catching, not as the drag being overridden. */
  detent: { type: 'spring', visualDuration: 0.3, bounce: 0.16 },
  /** The floating toolbar ducking out as a sheet takes over, and back */
  toolbar: { type: 'spring', visualDuration: 0.26, bounce: 0.12 },
} as const satisfies Record<string, Transition>

/**
 * Everything the app's two non-modal windows (About, the Manual) share about
 * how they arrive, leave and drag. Only `dragControls` and `dragConstraints`
 * stay at the call site — they name that window's own bar and layer. Held here
 * so the pair cannot drift the next time one of them is edited alone.
 */
export const windowMotion = () =>
  ({
    drag: true,
    dragListener: false,
    dragElastic: 0,
    dragMomentum: false,
    initial: { opacity: 0, y: 12, scale: 0.965 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 6, scale: 0.98, transition: SPRING.morphOut },
    transition: SPRING.morphIn,
  }) as const

/** Plain opacity fade for elements that shouldn't spring */
export const FADE: Transition = { duration: 0.12 }

// MediaQueryList is live, so `.matches` is current without a listener.
const REDUCED = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null

/**
 * Whether the user asked for less motion.
 *
 * App.tsx sets `MotionConfig reducedMotion="user"`, which covers motion's own
 * `x`/`y`/`scale`/layout props — but NOT a raw `transform` string, which it
 * treats as an ordinary value. Anything animating `transform` directly has to
 * ask for itself.
 */
export const prefersReducedMotion = () => REDUCED?.matches ?? false

/**
 * Enter/exit props shared by every popover and dropdown. `offset` is where it
 * slides in from: negative when the surface hangs below its trigger, positive
 * when it sits above.
 *
 * The movement is a full `transform` string rather than motion's `y`/`scale`
 * shorthands. The shorthands animate on the main thread through
 * requestAnimationFrame, so they stutter while the generate worker posts
 * annealing results; `transform` is one of the few values motion can hand
 * straight to the compositor.
 */
export function popoverMotion(offset = -6) {
  // Reduced motion keeps the fade — it's what explains that a surface arrived
  // — and drops only the travel.
  if (prefersReducedMotion()) {
    return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: SPRING.pop }
  }
  const away = `translateY(${offset}px) scale(0.97)`
  return {
    initial: { opacity: 0, transform: away },
    animate: { opacity: 1, transform: 'translateY(0px) scale(1)' },
    exit: { opacity: 0, transform: away },
    transition: SPRING.pop,
  }
}

/** Segmented-control pill slide (CSS transition string; element must sit inside .dialkit-root) */
export const PILL_TRANSITION =
  'left var(--dial-anim-reveal) cubic-bezier(0.25, 1, 0.5, 1), width var(--dial-anim-reveal) cubic-bezier(0.25, 1, 0.5, 1)'

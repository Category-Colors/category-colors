import type { ReactNode } from 'react'

// One weight, everywhere: ICON_STROKE on a 24-unit viewBox, carried by <Icon>
// for the icons in this file and imported by the handful that need an <svg> of
// their own (an animated `d`, a CSS mask). The rendered sizes vary a lot — 10px
// on the space chevron, 21px in the mobile bar — so the apparent weight does
// too; that is the trade any icon set with a fixed stroke makes, and it beats a
// per-size table nobody keeps current. Two glyphs are outside the rule and stay
// hand-written: PairGrid's status marks are 0.75 on a 12-unit viewBox (the same
// weight, scaled), and MobileBar's play triangle is filled, so its stroke rounds
// corners rather than drawing an outline and is sized for that instead.
export const ICON_STROKE = 1.5

// One <path> per icon, always — never a stroke split across two elements, and
// never a <rect>/<circle> resting on a stroke. A stroke is rasterized as a
// single filled region, so subpaths that overlap inside one element cost
// nothing; the same overlap across two elements is composited twice, and
// translucent ink (.mobile-bar-button's color-mix, any stroke-opacity) then
// doubles at every junction — a patch of visibly stronger ink where two lines
// meet. Pulling the strokes apart instead is not the fix: a round cap touches
// its neighbour at a single point, so tangency reads as a notch at every
// joint. Hence the boxes below are rounded-rect subpaths rather than
// <rect rx>, whose geometry they match exactly. Shapes that touch nothing
// (Photo's aperture, Ellipsis' dots) can stay their own elements.
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

export function LockIcon() {
  return (
    <Icon>
      <path d="M5 11H19a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V13a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4" />
    </Icon>
  )
}

export function PinIcon() {
  return (
    <Icon>
      <path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z" />
    </Icon>
  )
}

export function PlusIcon() {
  return (
    <Icon>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function XIcon() {
  return (
    <Icon>
      <path d="M18 6 6 18m0-12 12 12" />
    </Icon>
  )
}

export function CopyIcon() {
  return (
    <Icon>
      <path d="M10 8H18a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2zM16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </Icon>
  )
}

export function CheckIcon() {
  return (
    <Icon>
      <path d="m5 12 5 5L20 7" />
    </Icon>
  )
}

export function TrashIcon() {
  return (
    <Icon>
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
    </Icon>
  )
}

export function EllipsisIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  )
}

export function ChevronsDownUpIcon() {
  return (
    <Icon>
      <path d="m7 20 5-5 5 5" />
      <path d="m7 4 5 5 5-5" />
    </Icon>
  )
}

export function ChevronsUpDownIcon() {
  return (
    <Icon>
      <path d="m7 15 5 5 5-5" />
      <path d="m7 9 5-5 5 5" />
    </Icon>
  )
}

export function ChevronsLeftIcon() {
  return (
    <Icon>
      <path d="m11 17-5-5 5-5" />
      <path d="m18 17-5-5 5-5" />
    </Icon>
  )
}

export function PhotoIcon() {
  return (
    <Icon>
      <path d="M5 3H19a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm16 12-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      <circle cx="9" cy="9" r="2" />
    </Icon>
  )
}

export function SwatchesIcon() {
  return (
    <Icon>
      <path d="M19 3h-4a2 2 0 0 0 -2 2v12a4 4 0 0 0 8 0v-12a2 2 0 0 0 -2 -2M13 7.35l-2 -2a2 2 0 0 0 -2.828 0l-2.828 2.828a2 2 0 0 0 0 2.828l9 9M7.3 13h-2.3a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h12M17 17v.01" />
    </Icon>
  )
}

// A flat paint brush, upright: notched handle, ferrule band, rounded bristles.
// After Central Icons' paint-brush.
export function BrushIcon() {
  return (
    <Icon>
      <path d="M19 14V3h-5.5L12 5l-1.5-2H5v11h4.5l-.3 4.5a2.8 2.8 0 0 0 5.6 0l-.3-4.5zM5 10h14" />
    </Icon>
  )
}

export function ChevronsRightIcon() {
  return (
    <Icon>
      <path d="m6 17 5-5-5-5" />
      <path d="m13 17 5-5-5-5" />
    </Icon>
  )
}

// An open book: the manual. After Lucide's book-open, like the rest of this
// file, and the counterpart to the brush beside it in the nav row.
export function BookIcon() {
  return (
    <Icon>
      <path d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </Icon>
  )
}

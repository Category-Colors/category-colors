// The spaces the annealer can work in — one table describing each mode's
// channels, their UI bounds, and the slice of the space a fresh run starts
// from. The optimizer itself is mode-agnostic (it reads channels and gamut
// from culori's mode definition), so this table is the only thing that has to
// know a space exists.
//
// These mirror the CSS color formats the Output panel exports, plus okhsl —
// not expressible in CSS, but the best-behaved space to search in, and the
// default.

export type WorkingSpace = 'rgb' | 'hsl' | 'okhsl' | 'oklch' | 'oklab'

/** How a space arranges its channels, which decides how the map plots it. */
type Geometry =
  | 'cube' // cartesian, no lightness axis (rgb)
  | 'polar' // hue angle + radius + lightness (hsl, okhsl, oklch)
  | 'opponent' // lightness + two signed opponent axes (oklab)

export interface SpaceChannel {
  /** culori channel key, in the mode's own channel order */
  key: string
  /** panel label */
  label: string
  /** one-letter label for compact readouts */
  short: string
  min: number
  max: number
  step: number
  /** the range a fresh run starts with */
  initial: [number, number]
}

export interface WorkingSpaceDef {
  mode: WorkingSpace
  label: string
  geometry: Geometry
  channels: SpaceChannel[]
}

const HUE: SpaceChannel = {
  key: 'h',
  label: 'Hue',
  short: 'H',
  min: 0,
  max: 360,
  step: 1,
  initial: [0, 360],
}

export const WORKING_SPACES: WorkingSpaceDef[] = [
  {
    mode: 'rgb',
    label: 'RGB',
    geometry: 'cube',
    // culori keeps sRGB channels on 0–1, so the panel does too; every other
    // non-hue channel here is on the same scale
    channels: [
      { key: 'r', label: 'Red', short: 'R', min: 0, max: 1, step: 0.01, initial: [0, 1] },
      { key: 'g', label: 'Green', short: 'G', min: 0, max: 1, step: 0.01, initial: [0, 1] },
      { key: 'b', label: 'Blue', short: 'B', min: 0, max: 1, step: 0.01, initial: [0, 1] },
    ],
  },
  {
    mode: 'hsl',
    label: 'HSL',
    geometry: 'polar',
    channels: [
      HUE,
      { key: 's', label: 'Saturation', short: 'S', min: 0, max: 1, step: 0.01, initial: [0.3, 0.9] },
      // HSL lightness is not perceptual — saturation collapses toward both
      // ends, so a fresh run stays near the middle
      { key: 'l', label: 'Lightness', short: 'L', min: 0, max: 1, step: 0.01, initial: [0.3, 0.7] },
    ],
  },
  {
    mode: 'okhsl',
    label: 'OKHSL',
    geometry: 'polar',
    channels: [
      HUE,
      { key: 's', label: 'Saturation', short: 'S', min: 0, max: 1, step: 0.01, initial: [0.2, 0.8] },
      { key: 'l', label: 'Lightness', short: 'L', min: 0, max: 1, step: 0.01, initial: [0.3, 0.9] },
    ],
  },
  {
    mode: 'oklch',
    label: 'OKLCH',
    geometry: 'polar',
    channels: [
      { key: 'l', label: 'Lightness', short: 'L', min: 0, max: 1, step: 0.01, initial: [0.3, 0.9] },
      { key: 'c', label: 'Chroma', short: 'C', min: 0, max: 0.4, step: 0.01, initial: [0.02, 0.32] },
      HUE,
    ],
  },
  {
    mode: 'oklab',
    label: 'OKLAB',
    geometry: 'opponent',
    channels: [
      { key: 'l', label: 'Lightness', short: 'L', min: 0, max: 1, step: 0.01, initial: [0.3, 0.9] },
      // the full ±0.4 is mostly outside sRGB; a fresh run starts inside it
      { key: 'a', label: 'Green–red', short: 'A', min: -0.4, max: 0.4, step: 0.01, initial: [-0.2, 0.2] },
      { key: 'b', label: 'Blue–yellow', short: 'B', min: -0.4, max: 0.4, step: 0.01, initial: [-0.2, 0.2] },
    ],
  },
]

const BY_MODE = new Map(WORKING_SPACES.map((s) => [s.mode, s]))

export const WORKING_SPACE_MODES = WORKING_SPACES.map((s) => s.mode)

export const SPACE_OPTIONS = WORKING_SPACES.map((s) => ({ value: s.mode, label: s.label }))

export const isWorkingSpace = (v: unknown): v is WorkingSpace =>
  typeof v === 'string' && BY_MODE.has(v as WorkingSpace)

export const spaceDef = (mode: WorkingSpace): WorkingSpaceDef => BY_MODE.get(mode)!

export const spaceChannels = (mode: WorkingSpace) => spaceDef(mode).channels

export const spaceRangeLabels = (mode: WorkingSpace) =>
  spaceChannels(mode).map((c) => `${c.short} range`)

export const spaceInitialRanges = (mode: WorkingSpace): [number, number][] =>
  spaceChannels(mode).map((c) => [...c.initial] as [number, number])

import type { CvdType, EvaluatorSpec, EvaluatorType } from './palette'

// Display metadata for the evaluator set — one source of truth for the type
// list, its labels, and its help text. palette.ts validates imports against
// EVALUATOR_TYPES; the panels build their menus from TYPE_OPTIONS. (The type
// import is erased at compile time, so this pairing is not a runtime cycle.)

const TYPE_LABELS: Record<EvaluatorType, string> = {
  energy: 'Energy',
  range: 'Range',
  jnd: 'JND',
  cvd: 'CVD',
  similarity: 'Similarity',
  avoid: 'Avoid',
  contrast: 'Contrast',
  saliency: 'Saliency',
}

export const TYPE_HINTS: Record<EvaluatorType, string> = {
  energy: 'Pushes colors apart from each other',
  range: 'Evens out the spacing between colors',
  jnd: 'Penalizes pairs below the JND threshold',
  cvd: 'JND under simulated color-vision deficiency',
  similarity: 'Pulls the palette toward the targets',
  avoid: 'Pushes the palette away from these colors',
  contrast: 'Holds WCAG contrast against a background',
  saliency: 'Prefers vivid, nameable colors',
}

export const EVALUATOR_TYPES = Object.keys(TYPE_LABELS) as EvaluatorType[]

export const TYPE_OPTIONS = EVALUATOR_TYPES.map((value) => ({
  value,
  label: TYPE_LABELS[value],
}))

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const CVD_TYPES: CvdType[] = ['protanomaly', 'deuteranomaly', 'tritanomaly']

export const CVD_OPTIONS = CVD_TYPES.map((value) => ({ value, label: capitalize(value) }))

// CVD rows read better as the deficiency itself than as a generic "CVD"
export const evaluatorLabel = (spec: EvaluatorSpec) =>
  spec.type === 'cvd' ? capitalize(spec.cvd) : TYPE_LABELS[spec.type]

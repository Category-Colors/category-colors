import { useState, type ReactNode } from 'react'
import { AnimatePresence } from 'motion/react'
import { Slider, Toggle, ColorControl, SelectControl, Folder } from '@/components/dialkit'
import { hexValue } from '@/lib/color'
import { CVD_OPTIONS, TYPE_HINTS, evaluatorLabel } from '@/lib/evaluators'
import { newTargetColor, type CvdType, type EvaluatorSpec, type TargetColor } from '@/lib/palette'
import { AddColorBar } from './AddColorBar'
import { ColorRow } from './ColorRow'
import { ListEmptyState, ListRow } from './ReorderList'
import { XIcon } from './icons'

// Editable color list (similarity targets, avoid colors) whose rows show and
// hide like folder content. While empty, an empty-state slot with ghost add
// buttons stands in for the rows and the full add bar below; once the first
// color lands the two swap with the same choreography.
function ColorList({
  colors,
  onChange,
  empty,
  addLabel,
}: {
  colors: TargetColor[]
  onChange: (colors: TargetColor[]) => void
  empty: ReactNode
  addLabel: string
}) {
  // see ReorderList's `generation`: a preset replaces the list wholesale, and
  // remounting keeps the outgoing rows from collapsing under the incoming ones
  const [generation, setGeneration] = useState(0)
  const addBar = (ghost?: boolean) => (
    <AddColorBar
      ghost={ghost}
      label={addLabel}
      onAdd={() => onChange([...colors, newTargetColor()])}
      onAddMany={(hexes) => onChange([...colors, ...hexes.map((h) => newTargetColor(hexValue(h)))])}
      onReplace={(hexes) => {
        setGeneration((g) => g + 1)
        onChange(hexes.map((h) => newTargetColor(hexValue(h))))
      }}
    />
  )
  return (
    <>
      <div className="panel-list" key={generation}>
        <AnimatePresence initial={generation > 0}>
          {colors.length === 0 && (
            <ListEmptyState key="empty" actions={addBar(true)}>
              {empty}
            </ListEmptyState>
          )}
          {colors.map((color, i) => (
            <ListRow key={color.id}>
              <ColorRow
                value={color.value}
                onValueChange={(value) =>
                  onChange(colors.map((c, j) => (j === i ? { ...c, value } : c)))
                }
                onRemove={() => onChange(colors.filter((_, j) => j !== i))}
              />
            </ListRow>
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence initial={false}>
        {colors.length > 0 && <ListRow key="add-bar">{addBar()}</ListRow>}
      </AnimatePresence>
    </>
  )
}

// Title: the evaluator's name (CVD rows use the deficiency itself) with the
// weight as de-emphasized config text.
function specTitle(spec: EvaluatorSpec) {
  return (
    <>
      {evaluatorLabel(spec)}
      <span className="folder-title-meta">{spec.weight.toFixed(2)}</span>
    </>
  )
}

export function EvaluatorEditor({
  spec,
  onChange,
  onRemove,
  targets,
  onTargetsChange,
  defaultOpen = false,
}: {
  spec: EvaluatorSpec
  onChange: (spec: EvaluatorSpec) => void
  onRemove: () => void
  // Shared target list, edited inside similarity evaluators (the algorithm
  // has a single global similarityTarget)
  targets?: TargetColor[]
  onTargetsChange?: (targets: TargetColor[]) => void
  defaultOpen?: boolean
}) {
  const set = <K extends keyof EvaluatorSpec>(key: K, value: EvaluatorSpec[K]) =>
    onChange({ ...spec, [key]: value })

  return (
    <Folder
      title={specTitle(spec)}
      defaultOpen={defaultOpen}
      actions={
        <button className="color-row-icon" aria-label="Remove" onClick={onRemove}>
          <XIcon />
        </button>
      }
    >
      <p className="panel-hint">{TYPE_HINTS[spec.type]}</p>
      <Slider
        label="Weight"
        value={spec.weight}
        onChange={(v) => set('weight', v)}
        min={0}
        max={1}
        step={0.05}
      />
      {spec.type === 'cvd' && (
        <>
          <SelectControl
            label="Deficiency"
            value={spec.cvd}
            options={CVD_OPTIONS}
            onChange={(v) => set('cvd', v as CvdType)}
          />
          <Slider
            label="Severity"
            value={spec.cvdSeverity}
            onChange={(v) => set('cvdSeverity', v)}
            min={0}
            max={1}
            step={0.05}
          />
        </>
      )}
      {spec.type === 'similarity' && targets && onTargetsChange && (
        <ColorList
          colors={targets}
          onChange={onTargetsChange}
          empty="No target colors"
          addLabel="Add color"
        />
      )}
      {spec.type === 'avoid' && (
        <>
          <Slider
            label="Radius"
            value={spec.avoidRadius}
            onChange={(v) => set('avoidRadius', v)}
            min={0.05}
            max={0.5}
            step={0.05}
          />
          <ColorList
            colors={spec.avoidColors}
            onChange={(colors) => set('avoidColors', colors)}
            empty="No colors"
            addLabel="Add color"
          />
        </>
      )}
      {spec.type === 'contrast' && (
        <>
          <ColorControl
            label="Background"
            value={spec.background}
            onChange={(v) => set('background', v)}
          />
          <Slider
            label="Min ratio"
            value={spec.ratio}
            onChange={(v) => set('ratio', v)}
            min={1}
            max={7}
            step={0.5}
          />
          <Toggle
            label="Adjacent pairs"
            checked={spec.checkAdjacent}
            onChange={(v) => set('checkAdjacent', v)}
          />
        </>
      )}
    </Folder>
  )
}

import { useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { Slider, Toggle, Folder, SelectControl } from '@/components/dialkit'
import {
  DEFAULT_PARAMS,
  defaultColorSpace,
  newEvaluatorSpec,
  newInitColor,
  parseParams,
  type CvdType,
  type EvaluatorType,
  type PaletteParams,
  type WorkingSpace,
} from '@/lib/palette'
import { hexValue } from '@/lib/color'
import { SPACE_OPTIONS, spaceChannels, spaceDef } from '@/lib/color-spaces'
import { downloadText } from '@/lib/exporters'
import { AddColorBar } from './AddColorBar'
import { AddEvaluatorMenu } from './AddEvaluatorMenu'
import { ColorRow } from './ColorRow'
import { EvaluatorEditor } from './EvaluatorEditor'
import { TrashIcon } from './icons'
import { PanelShell } from './PanelShell'
import type { MotionValue } from 'motion/react'
import { PanelMenu } from './PanelMenu'
import { RangeSlider } from './RangeSlider'
import { CollapseAllButton } from './CollapseAllButton'
import { countOf, useSections } from './sections'
import { useBusyLabel } from '@/lib/use-busy-label'
import { ListEmptyState, ListRow, ReorderList } from './ReorderList'

const SECTIONS = ['space', 'init', 'evals', 'optimizer'] as const

const MAX_CONFIG_BYTES = 1_000_000

const replaceAt = <T,>(list: T[], index: number, item: T) =>
  list.map((entry, i) => (i === index ? item : entry))

const removeAt = <T,>(list: T[], index: number) => list.filter((_, i) => i !== index)

export function ParametersPanel({
  params,
  onParamsChange,
  onGenerate,
  busy,
  open,
  onOpenChange,
  hoverToOpen,
  width,
}: {
  params: PaletteParams
  onParamsChange: (params: PaletteParams) => void
  onGenerate: () => void
  busy: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  hoverToOpen: boolean
  width: MotionValue<number>
}) {
  const busyLabel = useBusyLabel(busy)
  const sections = useSections(SECTIONS)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof PaletteParams>(key: K, value: PaletteParams[K]) =>
    onParamsChange({ ...params, [key]: value })

  const addEvaluator = (type: EvaluatorType, cvd?: CvdType) =>
    set('evaluators', [...params.evaluators, newEvaluatorSpec(type, cvd && { cvd })])

  // a preset swaps the whole list rather than editing it; the counter tells
  // ReorderList to retire the old rows at once instead of crossfading them
  const [initGen, setInitGen] = useState(0)
  const initAddBar = (ghost?: boolean) => (
    <AddColorBar
      ghost={ghost}
      onAdd={() => set('initColors', [...params.initColors, newInitColor()])}
      onAddMany={(hexes) =>
        set('initColors', [...params.initColors, ...hexes.map((h) => newInitColor(hexValue(h)))])
      }
      onReplace={(hexes) => {
        setInitGen((g) => g + 1)
        set('initColors', hexes.map((h) => newInitColor(hexValue(h))))
      }}
    />
  )

  const importConfig = (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_CONFIG_BYTES) {
      alert('That configuration file is too large.')
      return
    }
    file.text().then(
      (text) => {
        const parsed = parseParams(text)
        if (parsed) onParamsChange(parsed)
        else alert('Not a valid configuration file.')
      },
      () => alert("That file couldn't be read.")
    )
  }

  const panelBody = (
    <>
      <Folder
        title="Configuration"
        isRoot
        actions={
          <>
            <PanelMenu
              items={[
                { label: 'Reset all', onClick: () => onParamsChange(DEFAULT_PARAMS) },
                {
                  label: 'Export configuration',
                  onClick: () =>
                    downloadText(
                      'category-colors-config.json',
                      JSON.stringify(params, null, 2),
                      'application/json'
                    ),
                },
                { label: 'Import configuration…', onClick: () => fileRef.current?.click() },
              ]}
            />
            <CollapseAllButton allCollapsed={sections.allCollapsed} onToggle={sections.toggleAll} />
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                importConfig(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </>
        }
      >
        <Slider
          label="Colors"
          value={params.colorCount}
          onChange={(v) => set('colorCount', v)}
          min={2}
          max={20}
          step={1}
        />
        <Folder
          title="Color space"
          open={sections.open.space}
          onOpenChange={sections.setSection('space')}
          summary={spaceDef(params.colorSpace.mode).label}
        >
          <SelectControl
            label="Space"
            value={params.colorSpace.mode}
            options={SPACE_OPTIONS}
            onChange={(mode) => set('colorSpace', defaultColorSpace(mode as WorkingSpace))}
          />
          {spaceChannels(params.colorSpace.mode).map((channel, i) => (
            <RangeSlider
              key={`${params.colorSpace.mode}-${channel.label}`}
              label={channel.label}
              value={params.colorSpace.ranges[i]}
              onChange={(range) =>
                set('colorSpace', {
                  ...params.colorSpace,
                  ranges: params.colorSpace.ranges.map((r, j) => (j === i ? range : r)),
                })
              }
              min={channel.min}
              max={channel.max}
              step={channel.step}
            />
          ))}
        </Folder>
        <Folder
          title="Initialize"
          open={sections.open.init}
          onOpenChange={sections.setSection('init')}
          summary={countOf(params.initColors.length, 'color')}
          actions={
            params.initColors.length > 0 && (
              <button
                className="color-row-icon"
                aria-label="Delete all"
                onClick={() => set('initColors', [])}
              >
                <TrashIcon />
              </button>
            )
          }
        >
          <ReorderList
            className="panel-list"
            items={params.initColors}
            onReorder={(next) => set('initColors', next)}
            empty="No colors"
            emptyActions={initAddBar(true)}
            generation={initGen}
          >
            {(color, i) => (
              <ColorRow
                value={color.value}
                onValueChange={(value) =>
                  set('initColors', replaceAt(params.initColors, i, { ...color, value }))
                }
                fixedColor={color.fixedColor}
                onFixedColorChange={(fixedColor) =>
                  set('initColors', replaceAt(params.initColors, i, { ...color, fixedColor }))
                }
                fixedOrder={color.fixedOrder}
                onFixedOrderChange={(fixedOrder) =>
                  set('initColors', replaceAt(params.initColors, i, { ...color, fixedOrder }))
                }
                onRemove={() => set('initColors', removeAt(params.initColors, i))}
              />
            )}
          </ReorderList>
          <AnimatePresence initial={false}>
            {params.initColors.length > 0 && <ListRow key="add-bar">{initAddBar()}</ListRow>}
          </AnimatePresence>
        </Folder>
        <Folder
          title="Evaluators"
          open={sections.open.evals}
          onOpenChange={sections.setSection('evals')}
          summary={countOf(params.evaluators.length, 'evaluator')}
          actions={
            params.evaluators.length > 0 && (
              <button
                className="color-row-icon"
                aria-label="Delete all"
                onClick={() => set('evaluators', [])}
              >
                <TrashIcon />
              </button>
            )
          }
        >
          <div className="panel-list">
            <AnimatePresence initial={false}>
              {params.evaluators.length === 0 && (
                <ListEmptyState key="empty" actions={<AddEvaluatorMenu ghost onAdd={addEvaluator} />}>
                  No evaluators
                </ListEmptyState>
              )}
              {params.evaluators.map((spec, i) => (
                <ListRow key={spec.id}>
                  <EvaluatorEditor
                    spec={spec}
                    onChange={(next) => set('evaluators', replaceAt(params.evaluators, i, next))}
                    onRemove={() => set('evaluators', removeAt(params.evaluators, i))}
                    targets={params.targets}
                    onTargetsChange={(targets) => set('targets', targets)}
                  />
                </ListRow>
              ))}
            </AnimatePresence>
          </div>
          <AnimatePresence initial={false}>
            {params.evaluators.length > 0 && (
              <ListRow key="add-menu">
                <AddEvaluatorMenu onAdd={addEvaluator} />
              </ListRow>
            )}
          </AnimatePresence>
        </Folder>
        <Folder
          title="Optimizer"
          open={sections.open.optimizer}
          onOpenChange={sections.setSection('optimizer')}
          summary={`${params.maxIterations.toLocaleString()} iterations`}
        >
          <Slider
            label="JND threshold"
            value={params.jnd}
            onChange={(v) => set('jnd', v)}
            min={5}
            max={40}
            step={1}
          />
          <Slider
            label="Iterations"
            value={params.maxIterations}
            onChange={(v) => set('maxIterations', v)}
            min={1000}
            max={100000}
            step={1000}
          />
          <Toggle
            label="Optimize order"
            checked={params.orderOptimization}
            onChange={(v) => set('orderOptimization', v)}
          />
        </Folder>
      </Folder>
      <div className="panel-footer">
        <div className="dialkit-button-group">
          <button
            className="dialkit-button generate-button"
            onClick={() => {
              if (!busy) onGenerate()
            }}
          >
            {busy && <span className="button-spinner" />}
            {busy ? busyLabel : 'Generate'}
          </button>
        </div>
      </div>
    </>
  )

  return (
    <PanelShell
      side="left"
      name="Configuration"
      open={open}
      onOpenChange={onOpenChange}
      hoverToOpen={hoverToOpen}
      width={width}
    >
      {panelBody}
    </PanelShell>
  )
}

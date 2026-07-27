import { useEffect, useRef, useState } from 'react'
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
import { SPACE_OPTIONS, spaceChannels } from '@/lib/color-spaces'
import { downloadText } from '@/lib/exporters'
import { AddColorBar } from './AddColorBar'
import { AddEvaluatorMenu } from './AddEvaluatorMenu'
import { ColorRow } from './ColorRow'
import { EvaluatorEditor } from './EvaluatorEditor'
import { ChevronsDownUpIcon, ChevronsUpDownIcon, TrashIcon } from './icons'
import { MorphPanel } from './MorphPanel'
import { PanelMenu } from './PanelMenu'
import { RangeSlider } from './RangeSlider'
import { ListEmptyState, ListRow, ReorderList } from './ReorderList'

const SECTIONS = ['space', 'init', 'evals', 'optimizer'] as const
type SectionKey = (typeof SECTIONS)[number]

// While the worker anneals, the button cycles through the stages of the
// craft every 5s so long runs feel alive
const BUSY_VERBS = ['Annealing…', 'Heating…', 'Cooling…', 'Tempering…', 'Quenching…', 'Polishing…']

const replaceAt = <T,>(list: T[], index: number, item: T) =>
  list.map((entry, i) => (i === index ? item : entry))

const removeAt = <T,>(list: T[], index: number) => list.filter((_, i) => i !== index)

export function ParametersPanel({
  params,
  onParamsChange,
  onGenerate,
  busy,
  minimized,
  onMinimizedChange,
}: {
  params: PaletteParams
  onParamsChange: (params: PaletteParams) => void
  onGenerate: () => void
  busy: boolean
  minimized: boolean
  onMinimizedChange: (minimized: boolean) => void
}) {
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    space: true,
    init: true,
    evals: true,
    optimizer: true,
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const [verbIndex, setVerbIndex] = useState(0)

  useEffect(() => {
    if (!busy) {
      setVerbIndex(0)
      return
    }
    const timer = setInterval(() => setVerbIndex((i) => i + 1), 5000)
    return () => clearInterval(timer)
  }, [busy])

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

  const allCollapsed = SECTIONS.every((key) => !openSections[key])
  const setAll = (open: boolean) =>
    setOpenSections({ space: open, init: open, evals: open, optimizer: open })
  const setSection = (key: SectionKey) => (open: boolean) =>
    setOpenSections((s) => ({ ...s, [key]: open }))

  const importConfig = (file: File | undefined) => {
    if (!file) return
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
            <button
              className="color-row-icon"
              aria-label={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
              onClick={() => setAll(allCollapsed)}
            >
              {allCollapsed ? <ChevronsUpDownIcon /> : <ChevronsDownUpIcon />}
            </button>
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
        <Folder title="Color space" open={openSections.space} onOpenChange={setSection('space')}>
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
          open={openSections.init}
          onOpenChange={setSection('init')}
          actions={
            <button
              className="color-row-icon"
              aria-label="Delete all"
              onClick={() => set('initColors', [])}
            >
              <TrashIcon />
            </button>
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
          open={openSections.evals}
          onOpenChange={setSection('evals')}
          actions={
            <button
              className="color-row-icon"
              aria-label="Delete all"
              onClick={() => set('evaluators', [])}
            >
              <TrashIcon />
            </button>
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
        <Folder title="Optimizer" open={openSections.optimizer} onOpenChange={setSection('optimizer')}>
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
            {busy ? BUSY_VERBS[verbIndex % BUSY_VERBS.length] : 'Generate'}
          </button>
        </div>
      </div>
    </>
  )

  return (
    <MorphPanel side="left" minimized={minimized} onMinimizedChange={onMinimizedChange}>
      {panelBody}
    </MorphPanel>
  )
}

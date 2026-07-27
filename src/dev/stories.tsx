import { useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence } from 'motion/react'
import { ButtonGroup } from '@/components/dialkit'
import { hexValue, valueToCss, type ColorValue } from '@/lib/color'
import {
  newEvaluatorSpec,
  newInitColor,
  newTargetColor,
  type EvaluatorSpec,
  type EvaluatorType,
  type InitColor,
  type TargetColor,
} from '@/lib/palette'
import { AddColorBar } from '@/components/panels/AddColorBar'
import { AddEvaluatorMenu } from '@/components/panels/AddEvaluatorMenu'
import { ColorRow } from '@/components/panels/ColorRow'
import { ColorPicker } from '@/components/panels/ColorPicker'
import { EvaluatorEditor } from '@/components/panels/EvaluatorEditor'
import { TYPE_OPTIONS } from '@/lib/evaluators'
import { ListRow, ReorderList } from '@/components/panels/ReorderList'

// Tiny in-app storybook: open /?story=color-row (any unknown name lists the
// registry). No dependency on Storybook proper — components render inside the
// same DialKit panel chrome the app uses.

const PANEL_WIDTHS = [260, 292, 340]

function PanelFrame({ width = 292, children }: { width?: number; children: ReactNode }) {
  return (
    <div className="dialkit-root" data-mode="inline" style={{ width, position: 'relative' }}>
      <div className="dialkit-panel" data-mode="inline">
        <div className="dialkit-panel-inner">{children}</div>
      </div>
    </div>
  )
}

function Specimen({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="flex flex-col gap-2">
      {children}
      <figcaption className="tabular-nums text-[11px] text-ink/40">{caption}</figcaption>
    </figure>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold tracking-tight text-ink/80">{title}</h2>
      {children}
    </section>
  )
}

function Removed({ onRestore }: { onRestore: () => void }) {
  return (
    <button
      className="rounded-md border border-dashed border-ink/20 px-3 py-2 tabular-nums text-[11px] text-ink/40 hover:text-ink/70"
      onClick={onRestore}
    >
      removed — click to restore
    </button>
  )
}

function InitRow({
  seed,
  defaultPickerOpen,
  withLocks = true,
}: {
  seed: Partial<InitColor>
  defaultPickerOpen?: boolean
  withLocks?: boolean
}) {
  const [color, setColor] = useState<InitColor>({
    ...newInitColor(hexValue('#F1781E')),
    ...seed,
  })
  const [removed, setRemoved] = useState(false)
  if (removed) return <Removed onRestore={() => setRemoved(false)} />
  return (
    <ColorRow
      value={color.value}
      onValueChange={(value) => setColor({ ...color, value })}
      fixedColor={withLocks ? color.fixedColor : undefined}
      onFixedColorChange={
        withLocks ? (fixedColor) => setColor({ ...color, fixedColor }) : undefined
      }
      fixedOrder={withLocks ? color.fixedOrder : undefined}
      onFixedOrderChange={
        withLocks ? (fixedOrder) => setColor({ ...color, fixedOrder }) : undefined
      }
      onRemove={() => setRemoved(true)}
      defaultPickerOpen={defaultPickerOpen}
    />
  )
}

function WidthPicker({ width, onChange }: { width: number; onChange: (width: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {PANEL_WIDTHS.map((w) => (
        <button
          key={w}
          onClick={() => onChange(w)}
          className={`rounded px-2 py-1 tabular-nums text-[11px] ${
            w === width ? 'bg-ink/15 text-ink/90' : 'text-ink/40 hover:text-ink/70'
          }`}
        >
          {w}px
        </button>
      ))}
    </div>
  )
}

function ListPlayground() {
  const [width, setWidth] = useState(292)
  const [colors, setColors] = useState<InitColor[]>([
    newInitColor(hexValue('#F1781E')),
    { ...newInitColor({ space: 'rgb', r: 216, g: 63, b: 65 }), fixedColor: true },
    {
      ...newInitColor({ space: 'oklch', l: 0.534, c: 0.23, h: 263.8 }),
      fixedColor: true,
      fixedOrder: true,
    },
  ])

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex flex-col gap-3">
        <WidthPicker width={width} onChange={setWidth} />
        <PanelFrame width={width}>
          <ReorderList className="panel-list" items={colors} onReorder={setColors}>
            {(color, i) => (
              <ColorRow
                value={color.value}
                onValueChange={(value) =>
                  setColors(colors.map((c, j) => (j === i ? { ...c, value } : c)))
                }
                fixedColor={color.fixedColor}
                onFixedColorChange={(fixedColor) =>
                  setColors(colors.map((c, j) => (j === i ? { ...c, fixedColor } : c)))
                }
                fixedOrder={color.fixedOrder}
                onFixedOrderChange={(fixedOrder) =>
                  setColors(colors.map((c, j) => (j === i ? { ...c, fixedOrder } : c)))
                }
                onRemove={() => setColors(colors.filter((_, j) => j !== i))}
              />
            )}
          </ReorderList>
          <ButtonGroup
            buttons={[
              { label: 'Add color', onClick: () => setColors([...colors, newInitColor()]) },
            ]}
          />
        </PanelFrame>
      </div>
      <pre className="rounded-lg bg-ink/[0.04] p-4 tabular-nums text-[11px] leading-relaxed text-ink/60">
        {JSON.stringify(
          colors.map(({ id: _id, ...rest }) => rest),
          null,
          2
        )}
      </pre>
    </div>
  )
}

function ColorRowStory() {
  return (
    <div className="flex flex-col gap-10">
      <Section title="Init color row — states">
        <div className="flex flex-wrap items-start gap-6">
          <Specimen caption="default">
            <PanelFrame>
              <InitRow seed={{}} />
            </PanelFrame>
          </Specimen>
          <Specimen caption="rgb · fixed value (lock)">
            <PanelFrame>
              <InitRow seed={{ value: { space: 'rgb', r: 216, g: 63, b: 65 }, fixedColor: true }} />
            </PanelFrame>
          </Specimen>
          <Specimen caption="oklch · fixed order (pin)">
            <PanelFrame>
              <InitRow
                seed={{ value: { space: 'oklch', l: 0.534, c: 0.23, h: 263.8 }, fixedOrder: true }}
              />
            </PanelFrame>
          </Specimen>
          <Specimen caption="oklab · fixed + pinned">
            <PanelFrame>
              <InitRow
                seed={{
                  value: { space: 'oklab', l: 0.57, a: -0.1, b: 0.15 },
                  fixedColor: true,
                  fixedOrder: true,
                }}
              />
            </PanelFrame>
          </Specimen>
          <Specimen caption="target (no locks)">
            <PanelFrame>
              <InitRow seed={{ value: hexValue('#009919') }} withLocks={false} />
            </PanelFrame>
          </Specimen>
        </div>
      </Section>

      <Section title="Picker open">
        <div style={{ paddingBottom: 330 }}>
          <Specimen caption="click to edit or type a css color; esc or click-away closes">
            <PanelFrame>
              <InitRow
                seed={{ value: { space: 'oklch', l: 0.534, c: 0.23, h: 263.8 } }}
                defaultPickerOpen
              />
            </PanelFrame>
          </Specimen>
        </div>
      </Section>

      <Section title="In context — list playground">
        <ListPlayground />
      </Section>
    </div>
  )
}

function ColorPickerStory() {
  const [first, setFirst] = useState<ColorValue>({ space: 'oklch', l: 0.534, c: 0.23, h: 263.8 })
  const [second, setSecond] = useState<ColorValue>({ space: 'rgb', r: 216, g: 63, b: 65 })
  return (
    <div className="flex flex-wrap items-start gap-10">
      <Specimen caption={`oklch start — ${valueToCss(first)}`}>
        <div className="dialkit-root">
          <div className="color-picker-popover" style={{ width: 264 }}>
            <ColorPicker value={first} onChange={setFirst} />
          </div>
        </div>
      </Specimen>
      <Specimen caption={`rgb start — ${valueToCss(second)}`}>
        <div className="dialkit-root">
          <div className="color-picker-popover" style={{ width: 232 }}>
            <ColorPicker value={second} onChange={setSecond} />
          </div>
        </div>
      </Specimen>
    </div>
  )
}

function EvalRow({
  type,
  overrides,
  defaultOpen,
}: {
  type: EvaluatorType
  overrides?: Partial<EvaluatorSpec>
  defaultOpen?: boolean
}) {
  const [spec, setSpec] = useState<EvaluatorSpec>(() => newEvaluatorSpec(type, overrides))
  const [removed, setRemoved] = useState(false)
  if (removed) return <Removed onRestore={() => setRemoved(false)} />
  return (
    <div className="panel-list">
      <EvaluatorEditor
        spec={spec}
        onChange={setSpec}
        onRemove={() => setRemoved(true)}
        defaultOpen={defaultOpen}
      />
    </div>
  )
}

function SimilarityRow() {
  const [spec, setSpec] = useState<EvaluatorSpec>(() => newEvaluatorSpec('similarity', { weight: 1 }))
  const [targets, setTargets] = useState<TargetColor[]>(() => [
    newTargetColor(hexValue('#F1781E')),
    newTargetColor(hexValue('#215BEF')),
  ])
  return (
    <div className="panel-list">
      <EvaluatorEditor
        spec={spec}
        onChange={setSpec}
        onRemove={() => {}}
        targets={targets}
        onTargetsChange={setTargets}
        defaultOpen
      />
    </div>
  )
}

function EvaluatorPlayground() {
  const [width, setWidth] = useState(292)
  const [targets, setTargets] = useState<TargetColor[]>(() => [
    newTargetColor(hexValue('#F1781E')),
    newTargetColor(hexValue('#D83F41')),
  ])
  const [specs, setSpecs] = useState<EvaluatorSpec[]>(() => [
    newEvaluatorSpec('energy', { weight: 0.15 }),
    newEvaluatorSpec('range', { weight: 0.15 }),
    newEvaluatorSpec('jnd', { weight: 0.15 }),
    newEvaluatorSpec('cvd', { weight: 0.15, cvd: 'protanomaly' }),
    newEvaluatorSpec('cvd', { weight: 0.5 }),
    newEvaluatorSpec('similarity', { weight: 1 }),
  ])

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex flex-col gap-3">
        <WidthPicker width={width} onChange={setWidth} />
        <PanelFrame width={width}>
          <div className="panel-list">
            {specs.map((spec, i) => (
              <EvaluatorEditor
                key={spec.id}
                spec={spec}
                onChange={(next) => setSpecs(specs.map((s, j) => (j === i ? next : s)))}
                onRemove={() => setSpecs(specs.filter((_, j) => j !== i))}
                targets={targets}
                onTargetsChange={setTargets}
              />
            ))}
          </div>
          <AddEvaluatorMenu
            onAdd={(type, cvd) => setSpecs([...specs, newEvaluatorSpec(type, cvd && { cvd })])}
          />
        </PanelFrame>
      </div>
      <pre className="max-h-[480px] overflow-auto rounded-lg bg-ink/[0.04] p-4 tabular-nums text-[11px] leading-relaxed text-ink/60">
        {JSON.stringify(
          specs.map(({ id: _id, ...rest }) => rest),
          null,
          2
        )}
      </pre>
    </div>
  )
}

function EvaluatorRowStory() {
  return (
    <div className="flex flex-col gap-10">
      <Section title="Evaluator row — one per type, collapsed">
        <div className="flex flex-wrap items-start gap-6">
          {TYPE_OPTIONS.map(({ value, label }) => (
            <Specimen key={value} caption={label.toLowerCase()}>
              <PanelFrame width={260}>
                <EvalRow type={value} />
              </PanelFrame>
            </Specimen>
          ))}
        </div>
      </Section>

      <Section title="Expanded — type-specific parameters">
        <div className="flex flex-wrap items-start gap-6">
          <Specimen caption="energy — weight only">
            <PanelFrame>
              <EvalRow type="energy" overrides={{ weight: 0.15 }} defaultOpen />
            </PanelFrame>
          </Specimen>
          <Specimen caption="cvd — deficiency + severity">
            <PanelFrame>
              <EvalRow type="cvd" overrides={{ weight: 0.5 }} defaultOpen />
            </PanelFrame>
          </Specimen>
          <Specimen caption="contrast — background + ratio + adjacency">
            <PanelFrame>
              <EvalRow type="contrast" defaultOpen />
            </PanelFrame>
          </Specimen>
          <Specimen caption="similarity — nested targets">
            <PanelFrame>
              <SimilarityRow />
            </PanelFrame>
          </Specimen>
          <Specimen caption="avoid — radius + nested colors">
            <PanelFrame>
              <EvalRow
                type="avoid"
                overrides={{
                  weight: 0.5,
                  avoidColors: [
                    newTargetColor(hexValue('#D83F41')),
                    newTargetColor(hexValue('#FFFFFF')),
                  ],
                }}
                defaultOpen
              />
            </PanelFrame>
          </Specimen>
        </div>
      </Section>

      <Section title="In context — playground with add menu">
        <EvaluatorPlayground />
      </Section>
    </div>
  )
}

function AddColorsPlayground() {
  const [width, setWidth] = useState(292)
  const [colors, setColors] = useState<InitColor[]>([
    newInitColor(hexValue('#F1781E')),
    newInitColor(hexValue('#215BEF')),
  ])

  const addBar = (ghost?: boolean) => (
    <AddColorBar
      ghost={ghost}
      onAdd={() => setColors([...colors, newInitColor()])}
      onAddMany={(hexes) =>
        setColors([...colors, ...hexes.map((hex) => newInitColor(hexValue(hex)))])
      }
      onReplace={(hexes) => setColors(hexes.map((hex) => newInitColor(hexValue(hex))))}
    />
  )

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex flex-col gap-3">
        <WidthPicker width={width} onChange={setWidth} />
        <PanelFrame width={width}>
          <ReorderList
            className="panel-list"
            items={colors}
            onReorder={setColors}
            empty="No colors"
            emptyActions={addBar(true)}
          >
            {(color, i) => (
              <ColorRow
                value={color.value}
                onValueChange={(value) =>
                  setColors(colors.map((c, j) => (j === i ? { ...c, value } : c)))
                }
                fixedColor={color.fixedColor}
                onFixedColorChange={(fixedColor) =>
                  setColors(colors.map((c, j) => (j === i ? { ...c, fixedColor } : c)))
                }
                fixedOrder={color.fixedOrder}
                onFixedOrderChange={(fixedOrder) =>
                  setColors(colors.map((c, j) => (j === i ? { ...c, fixedOrder } : c)))
                }
                onRemove={() => setColors(colors.filter((_, j) => j !== i))}
              />
            )}
          </ReorderList>
          <AnimatePresence initial={false}>
            {colors.length > 0 && <ListRow key="add-bar">{addBar()}</ListRow>}
          </AnimatePresence>
        </PanelFrame>
      </div>
      <pre className="max-h-[480px] overflow-auto rounded-lg bg-ink/[0.04] p-4 tabular-nums text-[11px] leading-relaxed text-ink/60">
        {JSON.stringify(
          colors.map((c) => c.value),
          null,
          2
        )}
      </pre>
    </div>
  )
}

function AddColorsStory() {
  return (
    <div className="flex flex-col gap-10">
      <Section title="Add bar — add · from image · presets">
        <Specimen caption="main button grows; icon buttons are square">
          <PanelFrame>
            <AddColorBar onAdd={() => {}} onAddMany={() => {}} onReplace={() => {}} />
          </PanelFrame>
        </Specimen>
      </Section>
      <Section title="In context — list playground">
        <AddColorsPlayground />
      </Section>
    </div>
  )
}

const STORIES: Record<string, { title: string; render: () => ReactNode }> = {
  'color-row': { title: 'Color row', render: () => <ColorRowStory /> },
  'color-picker': { title: 'Color picker', render: () => <ColorPickerStory /> },
  'evaluator-row': { title: 'Evaluator row', render: () => <EvaluatorRowStory /> },
  'add-colors': { title: 'Add colors', render: () => <AddColorsStory /> },
}

export function StoryPage({ name }: { name: string }) {
  const story = STORIES[name]
  return (
    <div className="min-h-svh px-10 py-8">
      <header className="mb-8 flex flex-col gap-2">
        <p className="text-[11px] font-medium tracking-[0.18em] text-ink/40 uppercase">
          Stories
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-ink/95">
          {story?.title ?? 'Index'}
        </h1>
      </header>
      {story ? (
        story.render()
      ) : (
        <ul className="flex flex-col gap-1">
          {Object.entries(STORIES).map(([key, s]) => (
            <li key={key}>
              <a className="tabular-nums text-[13px] text-ink/60 underline" href={`/?story=${key}`}>
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

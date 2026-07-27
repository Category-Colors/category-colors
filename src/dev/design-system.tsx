import type { ReactNode } from 'react'
import * as Icons from '@/components/panels/icons'
import { ButtonGroup, SegmentedControl } from '@/components/dialkit'
import { ColorRow } from '@/components/panels/ColorRow'
import { TooltipLayer } from '@/components/TooltipLayer'
import { hexValue } from '@/lib/color'

// Living reference at /design-system: tokens, components, icons, and the
// motion/interaction rules agents should follow when extending the app.

const COLOR_TOKENS: { name: string; value: string; css: string; note?: string }[] = [
  { name: 'Page', value: '#131316', css: '#131316', note: '--surface-page' },
  { name: 'Panel / popover glass', value: '#212121', css: '#212121', note: '--dial-glass-bg · .popover-surface' },
  { name: 'Surface', value: 'white 5%', css: 'rgba(255,255,255,0.05)', note: 'rows, active tabs' },
  { name: 'Surface hover', value: 'white 10%', css: 'rgba(255,255,255,0.1)' },
  { name: 'Card', value: 'white 3%', css: 'rgba(255,255,255,0.03)', note: 'main-area cards' },
  { name: 'Border', value: 'white 10%', css: 'rgba(255,255,255,0.1)', note: 'panels, popovers' },
  { name: 'Card ring', value: 'white 6%', css: 'rgba(255,255,255,0.06)' },
  { name: 'Text primary', value: 'white 95%', css: 'rgba(255,255,255,0.95)' },
  { name: 'Text secondary', value: 'white 60%', css: 'rgba(255,255,255,0.6)' },
  { name: 'Text tertiary', value: 'white 40%', css: 'rgba(255,255,255,0.4)' },
  { name: 'Failure', value: 'red-500', css: '#fb2c36', note: 'the only accent — failures only' },
  { name: 'Pass / neutral', value: 'white 55%', css: 'rgba(255,255,255,0.55)', note: 'passes stay quiet' },
]

const TYPE_SCALE: { size: number; weight: string; sample: string; use: string }[] = [
  { size: 18, weight: 'Medium', sample: 'Category colors', use: 'app title' },
  { size: 16, weight: 'Medium', sample: 'Temperature, next 7 days', use: 'card titles' },
  { size: 13, weight: 'Medium', sample: 'JND threshold', use: 'controls, tab labels' },
  { size: 12, weight: 'Regular', sample: 'Deuteranomaly · 0.50', use: 'list rows, popover rows' },
  { size: 11, weight: 'Regular', sample: '12,200 iterations · ΔE 23.1', use: 'data, chips, legends' },
  { size: 10, weight: 'Medium', sample: 'WCAG', use: 'group headings in popovers' },
  { size: 9, weight: 'Regular', sample: '0.30 – 0.90', use: 'chart micro-labels' },
]

const RADII = [
  { r: 14, use: 'panels' },
  { r: 12, use: 'popovers, cards' },
  { r: 10, use: 'boxes (map, stats)' },
  { r: 8, use: 'control rows' },
  { r: 6, use: 'tabs, tooltips, chips' },
  { r: 5, use: 'color swatches (16px)' },
  { r: 4, use: 'grid swatches' },
]

const MOTION_RULES = [
  ['Dwell before reveal', 'Hover surfaces wait before appearing: tooltips 200ms; popovers 120–150ms to open, 100ms to retarget. The dwell filters sweeps — a fast pass across triggers must never open anything.'],
  ['Instant enter, animated exit', 'When a hover surface appears it appears fully formed — no entrance transition (the dwell already provided anticipation). Exits animate: fade plus a slight shrink toward the anchor (scale 0.94, 140–240ms).'],
  ['Glide, don’t reopen', 'One shared element per pattern. Moving between anchors retargets its transform (≈240ms, cubic-bezier(0.3, 1, 0.35, 1)) so it glides; it never closes and reopens.'],
  ['Crossfade content', 'Content swaps use two stacked slots flipped in a single commit — old fades/blurs out (opacity + blur(5px), 140ms) while new fades in. Slots stay mounted so first swaps transition too.'],
  ['Scale from the anchor', 'transform-origin sits on the edge touching the trigger, so open/close motion grows out of and shrinks into the anchor. Keep scale inside the transform string — the standalone scale property misplaces the origin.'],
  ['Compositor only', 'Animate transform, opacity, scale, and filter exclusively. Position imperatively (style writes on refs); pointer movement must cause zero React re-renders. will-change: transform on the floating layer.'],
  ['Hit-testing hygiene', 'pointer-events: none whenever a floating surface is hidden. Interactive popovers get an invisible bridge spanning the anchor gap, and their anchor keeps a data-active highlight while the pointer is on the popover.'],
  ['Instant hover states', 'In-place hover feedback (cell and row backgrounds) applies immediately — no transition-colors. Reveals get dwell; feedback never does.'],
  ['Delegation', 'One listener pair per surface (container pointerover/pointerleave, or document-level for the tooltip layer), one getBoundingClientRect per settle, read-before-write.'],
  ['Escape hatches', 'Hide on scroll (a stranded fixed popover hovers over the wrong content) and on pointerdown for tooltips. Reduced motion is handled globally — never add per-component opt-outs.'],
]

const SEMANTIC_RULES = [
  ['Red means failure', 'red-500 (#fb2c36) marks failing tests and nothing else. Passes are neutral gray — a clean report shows no color except the palette itself.'],
  ['Palette colors are data', 'Never use palette colors decoratively. They appear only where they represent themselves: swatches, chips, chart marks.'],
  ['Numerals are tabular sans', 'Geist with tabular-nums everywhere numbers align. There is no mono font in the app.'],
  ['Ink on arbitrary color', 'Text over a palette color uses inkFor() (luminance-aware near-black or near-white), never a fixed color.'],
  ['Hover inspects, click acts', 'Popovers and tooltips only ever reveal information. Any mutation requires a click.'],
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] font-medium tracking-[-0.01em] text-ink">{title}</h2>
      {children}
    </section>
  )
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-ink/[0.03] p-5 ring-1 ring-ink/[0.06] ${className}`}>
      {children}
    </div>
  )
}

const DEMO_HEXES = ['#5ec896', '#547090', '#e47094', '#c4d6e6', '#d0e865', '#ba7a52']

export function DesignSystemPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-8 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-lg font-medium tracking-[-0.01em] text-ink">Design system</h1>
        <p className="max-w-[64ch] text-[13px] leading-relaxed text-ink/60">
          Tokens, components, and the motion rules this app is built on. Written for agents:
          when you add UI, match these patterns exactly — the sections below render the real
          components, so this page breaks if they do.
        </p>
      </header>

      <Section title="Color tokens">
        <Card>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-3">
            {COLOR_TOKENS.map((token) => (
              <div key={token.name} className="flex items-center gap-2.5 py-1">
                <span
                  className="size-6 shrink-0 rounded-md ring-1 ring-ink/15"
                  style={{ background: token.css }}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[12px] text-ink/80">{token.name}</span>
                  <span className="truncate tabular-nums text-[10px] text-ink/40">
                    {token.value}
                    {token.note ? ` · ${token.note}` : ''}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="Type scale — Geist, tabular numerals, no mono">
        <Card>
          <div className="flex flex-col gap-1.5">
            {TYPE_SCALE.map((step) => (
              <div key={step.size} className="flex items-baseline gap-4">
                <span className="w-14 shrink-0 text-right tabular-nums text-[10px] text-ink/35">
                  {step.size}px {step.weight}
                </span>
                <span
                  className="truncate tabular-nums text-ink/90"
                  style={{ fontSize: step.size, fontWeight: step.weight === 'Medium' ? 500 : 400 }}
                >
                  {step.sample}
                </span>
                <span className="ml-auto shrink-0 text-[10px] text-ink/35">{step.use}</span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="Radii">
        <Card>
          <div className="flex flex-wrap items-end gap-5">
            {RADII.map(({ r, use }) => (
              <div key={r} className="flex flex-col items-center gap-1.5">
                <div className="size-12 bg-ink/10 ring-1 ring-ink/15" style={{ borderRadius: r }} />
                <span className="tabular-nums text-[10px] text-ink/50">{r}px</span>
                <span className="text-[9px] text-ink/35">{use}</span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="Icons">
        <Card>
          <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
            {Object.entries(Icons).map(([name, Icon]) => (
              <div key={name} className="flex items-center gap-2 rounded-md px-2 py-1.5">
                <span className="flex size-5 shrink-0 items-center justify-center text-ink/70 [&_svg]:size-4">
                  <Icon />
                </span>
                <span className="truncate text-[10px] text-ink/45">{name.replace(/Icon$/, '')}</span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="Components">
        <div className="dialkit-root grid gap-4 md:grid-cols-2" data-mode="inline">
          <Card className="flex flex-col gap-4">
            <p className="text-[10px] font-medium tracking-[0.08em] text-ink/35 uppercase">
              Icon buttons — hover for the 200ms tooltip
            </p>
            <div className="flex gap-1">
              <button className="color-row-icon" aria-label="Fix value"><Icons.LockIcon /></button>
              <button className="color-row-icon" aria-label="Fix order"><Icons.PinIcon /></button>
              <button className="color-row-icon" aria-label="Copy value"><Icons.CopyIcon /></button>
              <button className="color-row-icon" aria-label="Delete all"><Icons.TrashIcon /></button>
              <button className="color-row-icon" aria-label="Remove"><Icons.XIcon /></button>
              <button className="color-row-icon" aria-label="More actions"><Icons.EllipsisIcon /></button>
            </div>
            <p className="text-[10px] font-medium tracking-[0.08em] text-ink/35 uppercase">
              Count chips — failure / pass
            </p>
            <div className="flex gap-2">
              <span className="rounded-full bg-danger/10 px-2 py-0.5 tabular-nums text-[11px] text-danger/90">13</span>
              <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 tabular-nums text-[11px] text-ink/55">0</span>
            </div>
            <p className="text-[10px] font-medium tracking-[0.08em] text-ink/35 uppercase">
              Facepile chips (16px, 5px radius)
            </p>
            <div className="flex gap-[3px]">
              {DEMO_HEXES.map((hex) => (
                <span key={hex} className="size-4 rounded-[5px]" style={{ background: hex }} />
              ))}
            </div>
            <p className="text-[10px] font-medium tracking-[0.08em] text-ink/35 uppercase">
              Buttons
            </p>
            <ButtonGroup buttons={[{ label: 'Copy', onClick: () => {} }, { label: 'Download', onClick: () => {} }]} />
            <SegmentedControl
              options={[
                { value: 'hex', label: 'Hex' },
                { value: 'css', label: 'CSS' },
                { value: 'json', label: 'JSON' },
              ]}
              value="hex"
              onChange={() => {}}
            />
          </Card>
          <Card className="flex flex-col gap-4">
            <p className="text-[10px] font-medium tracking-[0.08em] text-ink/35 uppercase">
              Color rows — editable and read-only
            </p>
            <div className="flex flex-col">
              <ColorRow value={hexValue('#5ec896')} onValueChange={() => {}} onRemove={() => {}} onCopy={() => {}} />
              <ColorRow value={hexValue('#e47094')} />
            </div>
            <p className="text-[10px] font-medium tracking-[0.08em] text-ink/35 uppercase">
              Popover surface (.popover-surface)
            </p>
            <div className="popover-surface w-56 self-start">
              <div className="flex flex-col gap-2.5 p-3">
                <div className="flex h-8 overflow-hidden rounded-lg ring-1 ring-ink/10">
                  <span className="flex-1" style={{ background: '#5ec896' }} />
                  <span className="flex-1" style={{ background: '#751a5d' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-medium text-ink/45">JND</p>
                  <div className="flex items-baseline justify-between text-[12px]">
                    <span className="text-ink/75">No CVD</span>
                    <span className="tabular-nums text-ink/80">65.8</span>
                  </div>
                  <div className="flex items-baseline justify-between text-[12px]">
                    <span className="text-ink/75">Non-text contrast</span>
                    <span className="tabular-nums text-danger/80">1.44</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Motion & interaction rules">
        <Card>
          <div className="flex flex-col gap-3">
            {MOTION_RULES.map(([rule, detail]) => (
              <div key={rule} className="flex flex-col gap-0.5">
                <p className="text-[12px] font-medium text-ink/85">{rule}</p>
                <p className="max-w-[72ch] text-[12px] leading-relaxed text-ink/55">{detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="Semantics">
        <Card>
          <div className="flex flex-col gap-3">
            {SEMANTIC_RULES.map(([rule, detail]) => (
              <div key={rule} className="flex flex-col gap-0.5">
                <p className="text-[12px] font-medium text-ink/85">{rule}</p>
                <p className="max-w-[72ch] text-[12px] leading-relaxed text-ink/55">{detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <TooltipLayer />
    </div>
  )
}

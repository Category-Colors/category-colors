import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from 'react'
import { createPortal } from 'react-dom'
import { valueToCss } from '@/lib/color'
import { spaceRangeLabels } from '@/lib/color-spaces'
import { evaluatorLabel } from '@/lib/evaluators'
import type { PaletteVersion } from '@/lib/palette'

export interface HistoryPopoverHandle {
  show(version: PaletteVersion, el: Element): void
  hide(): void
}

const fmtRange = ([lo, hi]: [number, number]) =>
  hi > 2 ? `${Math.round(lo)}–${Math.round(hi)}` : `${lo.toFixed(2)}–${hi.toFixed(2)}`

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12px]">
      <span className="text-ink/75">{label}</span>
      <span className="tabular-nums text-ink/80">{value}</span>
    </div>
  )
}

function ChipsRow({ label, hexes }: { label: string; hexes: string[] }) {
  if (hexes.length === 0) return null
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="text-ink/75">{label}</span>
      <span className="flex max-w-32 flex-wrap justify-end gap-1">
        {hexes.map((hex, i) => (
          <span
            key={i}
            className="size-3 rounded-full ring-1 ring-ink/15"
            style={{ background: hex }}
          />
        ))}
      </span>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-medium text-ink/45">{title}</p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}

// Compact read of a version: the palette itself plus the full configuration
// that produced it, in the report popover's visual language.
function VersionDetail({ version }: { version: PaletteVersion }) {
  const { params } = version
  const rangeLabels = spaceRangeLabels(params.colorSpace.mode)
  // presets, imports, and from-scratch edits arrive without an annealing
  // run — their params are ambient panel state, not choices, so the whole
  // configuration report is withheld, not just cost/iterations
  const optimized = version.costHistory.length > 0
  return (
    <div className="flex w-56 flex-col gap-2.5 p-3">
      <div className="flex flex-col gap-2">
        <Group title="RESULT">
          <Row label="Version" value={`v${version.id}`} />
          <Row label="Colors" value={version.colors.length} />
          {optimized ? (
            <>
              <Row label="Cost" value={version.cost.toFixed(4)} />
              <Row label="Iterations" value={version.iterations.toLocaleString()} />
            </>
          ) : (
            <p className="text-[11px] text-ink/35">Optimizer not run</p>
          )}
        </Group>
        {optimized && (
          <>
            <Group title="CONFIGURATION">
              <Row label="Space" value={params.colorSpace.mode} />
              {params.colorSpace.ranges.map((range, i) => (
                <Row key={i} label={rangeLabels[i] ?? `Range ${i + 1}`} value={fmtRange(range)} />
              ))}
              <Row label="JND threshold" value={params.jnd} />
              <Row label="Order optimization" value={params.orderOptimization ? 'on' : 'off'} />
              <ChipsRow label="Seeds" hexes={params.initColors.map((c) => valueToCss(c.value))} />
              <ChipsRow label="Targets" hexes={params.targets.map((t) => valueToCss(t.value))} />
            </Group>
            <Group title="EVALUATORS">
              {params.evaluators.map((spec) => (
                <Row key={spec.id} label={evaluatorLabel(spec)} value={spec.weight.toFixed(2)} />
              ))}
            </Group>
          </>
        )}
      </div>
    </div>
  )
}

// Same imperative popover approach as the report's pair grid: portal, fixed,
// compositor-only transitions, dual-slot crossfade. This one is info-only
// (pointer-events: none, no bridge) and anchors to the left of its row,
// vertically centered and clamped to the viewport after measuring.
export function HistoryPopover({ ref }: { ref: Ref<HistoryPopoverHandle> }) {
  const popRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<{
    slots: [PaletteVersion | null, PaletteVersion | null]
    front: 0 | 1
    rect: DOMRect | null
    panelLeft: number
    fresh: boolean
    gen: number
  }>({ slots: [null, null], front: 0, rect: null, panelLeft: 0, fresh: true, gen: 0 })
  const state = useRef({
    visible: false,
    id: 0,
    pos: '',
    anchorEl: null as Element | null,
    hideTimer: 0,
    moveTimer: 0,
  })

  const OPEN_DWELL = 150
  const MOVE_DWELL = 100

  const hideNow = () => {
    const s = state.current
    const pop = popRef.current
    if (!pop || !s.visible) return
    s.visible = false
    s.anchorEl?.removeAttribute('data-active')
    s.anchorEl = null
    pop.style.opacity = '0'
    pop.style.transform = `${s.pos} scale(0.94)` // shrink toward the anchor
    pop.style.pointerEvents = 'none'
  }
  const scheduleHide = () => {
    const s = state.current
    window.clearTimeout(s.hideTimer)
    window.clearTimeout(s.moveTimer)
    s.hideTimer = window.setTimeout(hideNow, 80)
  }
  const cancelHide = () => {
    const s = state.current
    window.clearTimeout(s.hideTimer)
    window.clearTimeout(s.moveTimer)
  }

  useImperativeHandle(ref, () => {
    const s = state.current
    const settle = (version: PaletteVersion, el: Element) => {
      s.id = version.id
      const rect = el.getBoundingClientRect()
      // the anchor row keeps its highlight while the pointer is on the popover
      s.anchorEl?.removeAttribute('data-active')
      s.anchorEl = el
      el.setAttribute('data-active', '')
      // anchor horizontally to the panel edge, not the row, so the popover
      // sits a consistent 4px off the panel regardless of row insets
      const panelLeft =
        el.closest('.panel-morph')?.getBoundingClientRect().left ?? rect.left
      setView((v) => {
        const fresh = !s.visible
        if (v.slots[v.front]?.id === version.id) {
          return { ...v, rect, panelLeft, fresh, gen: v.gen + 1 }
        }
        const back = v.front === 0 ? 1 : 0
        const slots = [...v.slots] as [PaletteVersion | null, PaletteVersion | null]
        slots[back] = version
        return { slots, front: back, rect, panelLeft, fresh, gen: v.gen + 1 }
      })
    }
    return {
      show(version, el) {
        window.clearTimeout(s.hideTimer)
        window.clearTimeout(s.moveTimer)
        if (!s.visible) {
          s.moveTimer = window.setTimeout(() => settle(version, el), OPEN_DWELL)
        } else if (version.id !== s.id) {
          s.moveTimer = window.setTimeout(() => settle(version, el), MOVE_DWELL)
        }
      },
      hide: scheduleHide,
    }
  }, [])

  // position after the content committed: height is measurable, so the
  // popover can center on its row and clamp to the viewport
  useLayoutEffect(() => {
    const s = state.current
    const pop = popRef.current
    if (!pop || !view.rect) return
    const h = pop.offsetHeight
    const y = Math.min(
      Math.max(view.rect.top + view.rect.height / 2 - h / 2, 12),
      window.innerHeight - h - 12
    )
    const target = `translate3d(${view.panelLeft - 4}px, ${y}px, 0) translate(-100%, 0)`
    s.pos = target
    pop.style.transformOrigin = `100% ${Math.min(Math.max(view.rect.top + view.rect.height / 2 - y, 12), h - 12)}px`
    if (view.fresh) {
      // enter is instant (the dwell already provided the pause); the exit
      // keeps its shrink-toward-anchor animation
      pop.style.transitionProperty = 'none'
      pop.style.transform = `${target} scale(1)`
      pop.style.opacity = '1'
      void pop.offsetWidth
      pop.style.transitionProperty = ''
    } else {
      pop.style.transform = `${target} scale(1)`
      pop.style.opacity = '1'
    }
    pop.style.pointerEvents = 'auto'
    s.visible = true
  }, [view])

  // stranded fixed-position popover on scroll: drop it immediately
  useEffect(() => {
    const popoverState = state.current
    const onScroll = () => {
      window.clearTimeout(popoverState.hideTimer)
      window.clearTimeout(popoverState.moveTimer)
      hideNow()
    }
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.clearTimeout(popoverState.hideTimer)
      window.clearTimeout(popoverState.moveTimer)
      popoverState.anchorEl?.removeAttribute('data-active')
    }
  }, [])

  return createPortal(
    <div
      ref={popRef}
      onPointerEnter={cancelHide}
      onPointerLeave={scheduleHide}
      className="popover-surface fixed top-0 left-0 z-50 w-56 will-change-transform"
      style={
        {
          opacity: 0,
          pointerEvents: 'none',
          transform: 'translate3d(0, 0, 0) scale(0.94)',
          transitionProperty: 'transform, opacity',
          transitionDuration: '240ms, 140ms',
          transitionTimingFunction: 'cubic-bezier(0.3, 1, 0.35, 1)',
        } as CSSProperties
      }
    >
      {/* safety corridor across the popover↔row gap so the pointer can
          travel to the content without dropping hover */}
      <div className="absolute inset-y-0 left-full w-4" />
      <div className="grid">
        {view.slots.map((version, idx) => {
          const front = view.front === idx
          return (
            <div
              key={idx}
              className="[grid-area:1/1]"
              style={{
                opacity: front && version ? 1 : 0,
                filter: front ? 'none' : 'blur(5px)',
                zIndex: front ? 1 : 0,
                // fresh opens show their content immediately; only glides
                // between rows crossfade
                transition: view.fresh ? 'none' : 'opacity 140ms ease, filter 140ms ease',
              }}
            >
              {version && <VersionDetail version={version} />}
            </div>
          )
        })}
      </div>
    </div>,
    document.body
  )
}

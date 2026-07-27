import {
  Fragment,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from 'react'
import { createPortal } from 'react-dom'
import { wcagContrast } from 'culori'
import { colorVsBackground, testTitles, type JndReport } from '@/lib/report'
import { useTheme } from '@/lib/theme'
import { inkFor } from '@/lib/weather'

// Swatch popovers measure each color against the page it sits on, so this has
// to be the live theme background — a stale constant would report contrast
// against a page that isn't there.

interface PairCell {
  normal: number
  tests: { title: string; deltaE: number; fail: boolean }[]
  failLetters: string[]
}

// One entry per unordered pair, keyed "a:b" with a < b
function buildCells(report: JndReport, threshold: number): Map<string, PairCell> {
  const cells = new Map<string, PairCell>()
  const titles = testTitles(report.tests)
  report.tests.forEach((test, t) => {
    const letter = test.label === 'normal' ? 'N' : test.label.charAt(0).toUpperCase()
    for (const pair of test.pairs ?? test.issues) {
      const key = `${pair.indexA}:${pair.indexB}`
      const cell = cells.get(key) ?? { normal: 0, tests: [], failLetters: [] }
      const fail = pair.deltaE < threshold
      if (test.label === 'normal') cell.normal = pair.deltaE
      cell.tests.push({ title: titles[t], deltaE: pair.deltaE, fail })
      if (fail && !cell.failLetters.includes(letter)) cell.failLetters.push(letter)
      cells.set(key, cell)
    }
  })
  return cells
}

function StatusIcon({ fail }: { fail: boolean }) {
  return fail ? (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-danger" aria-hidden>
      <path
        d="M3.125 3.125L8.875 8.875M8.875 3.125L3.125 8.875"
        stroke="currentColor"
        strokeOpacity="0.65"
        strokeWidth="0.75"
        strokeLinecap="round"
      />
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-ink" aria-hidden>
      <path
        d="M3 7.075L5.01605 9L9 3.5"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="0.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function StatRow({ label, value, fail }: { label: string; value: string; fail: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-[12px]">
      <span className="text-ink/75">{label}</span>
      <span className="flex items-center gap-1">
        <span className={`tabular-nums ${fail ? 'text-danger/80' : 'text-ink/80'}`}>
          {value}
        </span>
        <StatusIcon fail={fail} />
      </span>
    </div>
  )
}

function PairDetail({ a, b, cell }: { a: string; b: string; cell: PairCell }) {
  const ratio = wcagContrast(a, b)
  return (
    <div className="flex w-56 flex-col gap-2.5 p-3">
      <div className="flex h-8 overflow-hidden rounded-lg ring-1 ring-ink/10">
        <span className="flex-1" style={{ background: a }} />
        <span className="flex-1" style={{ background: b }} />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-medium text-ink/45">JND</p>
          <div className="flex flex-col gap-0.5">
            {cell.tests.map((t) => (
              <StatRow key={t.title} label={t.title} value={t.deltaE.toFixed(1)} fail={t.fail} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-medium text-ink/45">WCAG</p>
          {/* WCAG 1.4.11 non-text contrast: graphical objects need ≥ 3:1 */}
          <StatRow label="Non-text contrast" value={ratio.toFixed(2)} fail={ratio < 3} />
        </div>
      </div>
    </div>
  )
}

interface PopoverHandle {
  show(key: string, el: Element): void
  hide(): void
}

// One shared popover for the whole grid, positioned imperatively so a hover
// never re-renders React and every animated property (transform, scale,
// opacity, filter) stays on the compositor. Gliding between cells is a
// transform transition; content swaps hide behind a short blur/fade.
function PairPopover({
  cells,
  colors,
  pageBg,
  ref,
}: {
  cells: Map<string, PairCell>
  colors: string[]
  pageBg: string
  ref: Ref<PopoverHandle>
}) {
  const popRef = useRef<HTMLDivElement>(null)
  // two stacked content slots; flipping `front` crossfades old and new
  // simultaneously in a single commit. `instant` marks fresh opens, where
  // the current content must appear immediately instead of fading in.
  const [view, setView] = useState<{
    slots: [string | null, string | null]
    front: 0 | 1
    instant: boolean
  }>({ slots: [null, null], front: 0, instant: true })
  const state = useRef({
    visible: false,
    key: null as string | null,
    pos: '',
    anchorEl: null as Element | null,
    hideTimer: 0,
    moveTimer: 0,
  })
  const swap = (nextKey: string, instant: boolean) =>
    setView((v) => {
      if (v.slots[v.front] === nextKey) return v
      const back = v.front === 0 ? 1 : 0
      const slots = [...v.slots] as [string | null, string | null]
      slots[back] = nextKey
      return { slots, front: back, instant }
    })

  // dwell before opening or retargeting: a fast sweep across the grid never
  // opens the popover, and while it's open it stays parked — fully rendered —
  // until the pointer actually settles on a new cell
  const OPEN_DWELL = 120
  const MOVE_DWELL = 100

  const bridgeRef = useRef<HTMLDivElement>(null)

  const hideNow = () => {
    const s = state.current
    const pop = popRef.current
    if (!pop || !s.visible) return
    s.visible = false
    s.anchorEl?.removeAttribute('data-active')
    s.anchorEl = null
    pop.style.transform = `${s.pos} scale(0.94)` // shrink toward the anchor
    pop.style.opacity = '0'
    // while hidden the box must not block hover on the cells beneath it
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
    const aim = (el: Element) => {
      const rect = el.getBoundingClientRect()
      // the anchor cell keeps its highlight while the pointer visits the
      // popover, when CSS :hover no longer applies
      s.anchorEl?.removeAttribute('data-active')
      s.anchorEl = el
      el.setAttribute('data-active', '')
      // anchor with -100%/0% so no height measurement is ever needed
      const above = rect.top > 300
      const pos = `translate3d(${rect.left + rect.width / 2}px, ${
        above ? rect.top - 8 : rect.bottom + 8
      }px, 0) translate(-50%, ${above ? '-100%' : '0%'})`
      s.pos = pos
      const pop = popRef.current
      if (pop) {
        // scale from the edge that touches the cell, so the popover grows
        // out of the cell that triggered it (invisible at scale(1); aims
        // the open/close animations)
        pop.style.transformOrigin = above ? '50% 100%' : '50% 0%'
      }
      const bridge = bridgeRef.current
      if (bridge) {
        // the hover bridge spans the gap on whichever side faces the cell
        bridge.style.top = above ? '100%' : 'auto'
        bridge.style.bottom = above ? 'auto' : '100%'
      }
      return pos
    }
    const openAt = (nextKey: string, el: Element) => {
      const pop = popRef.current
      if (!pop) return
      const pos = aim(el)
      // enter is instant (the dwell already provided the pause); the exit
      // keeps its shrink-toward-anchor animation
      pop.style.transitionProperty = 'none'
      pop.style.transform = `${pos} scale(1)`
      pop.style.opacity = '1'
      void pop.offsetWidth
      pop.style.transitionProperty = ''
      pop.style.pointerEvents = 'auto'
      s.visible = true
      if (nextKey !== s.key) {
        s.key = nextKey
        swap(nextKey, true) // clean open: content appears with the popover
      }
    }
    const glideTo = (nextKey: string, el: Element) => {
      const pop = popRef.current
      if (!pop) return
      pop.style.transform = `${aim(el)} scale(1)`
      if (nextKey === s.key) return
      s.key = nextKey
      swap(nextKey, false) // both layers transition in one commit: a true crossfade
    }
    return {
      show(nextKey, el) {
        cancelHide()
        if (!s.visible) {
          s.moveTimer = window.setTimeout(() => openAt(nextKey, el), OPEN_DWELL)
        } else if (nextKey !== s.key) {
          s.moveTimer = window.setTimeout(() => glideTo(nextKey, el), MOVE_DWELL)
        }
        // re-entering the current cell: pending retargets are already cancelled
      },
      hide: scheduleHide,
    }
  }, [])

  // a fixed popover left behind by scrolling would hover over the wrong
  // cells now that it's interactive — drop it immediately
  useEffect(() => {
    const popoverState = state.current
    const onScroll = () => {
      cancelHide()
      hideNow()
    }
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.clearTimeout(popoverState.hideTimer)
      window.clearTimeout(popoverState.moveTimer)
      popoverState.anchorEl?.removeAttribute('data-active')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {/* invisible strip spanning the cell↔popover gap so the pointer can
          travel to the content without dropping hover */}
      <div ref={bridgeRef} className="absolute inset-x-0 h-2.5" />
      <div className="grid">
        {view.slots.map((slotKey, idx) => {
          // slots stay mounted even while empty so the opacity flip always
          // transitions — a fresh mount would pop in at full opacity
          const cell = slotKey ? cells.get(slotKey) : null
          // "s:i" = swatch key (color vs page background); "a:b" = pair key
          const swatch = slotKey?.startsWith('s:')
          const [aIdx, bIdx] = slotKey && !swatch ? slotKey.split(':').map(Number) : [0, 0]
          const a = swatch ? colors[Number(slotKey!.slice(2))] : colors[aIdx]
          const b = swatch ? pageBg : colors[bIdx]
          const front = view.front === idx
          return (
            <div
              key={idx}
              className="[grid-area:1/1]"
              style={{
                opacity: front && cell ? 1 : 0,
                filter: front ? 'none' : 'blur(5px)',
                zIndex: front ? 1 : 0,
                transition: view.instant ? 'none' : 'opacity 140ms ease, filter 140ms ease',
              }}
            >
              {cell && <PairDetail a={a} b={b} cell={cell} />}
            </div>
          )
        })}
      </div>
    </div>,
    document.body
  )
}

// Lower triangle only: with no in-cell color rendering, ΔE and contrast are
// symmetric, so the upper half would be pure repetition. Each cell is two
// numbers — ΔE (red with test letters when failing) over contrast ratio —
// with the full detail in the shared hover popover.
// 28px header swatch carrying its own vs-background numbers (ΔE over
// contrast ratio) in luminance-aware ink
function HeaderSwatch({
  color,
  index,
  cell,
  pageBg,
}: {
  color: string
  index: number
  cell?: PairCell
  pageBg: string
}) {
  const ink = inkFor(color)
  return (
    <div
      data-pair={`s:${index}`}
      className="flex size-[34px] shrink-0 cursor-default flex-col items-center justify-center rounded leading-[1.15] hover:ring-1 hover:ring-ink/40 data-active:ring-1 data-active:ring-ink/40"
      style={{ background: color }}
    >
      <span className="tabular-nums text-[10px] font-medium" style={{ color: ink }}>
        {cell ? cell.normal.toFixed(1) : ''}
      </span>
      <span className="tabular-nums text-[9px]" style={{ color: ink, opacity: 0.6 }}>
        {wcagContrast(color, pageBg).toFixed(1)}
      </span>
    </div>
  )
}

export function PairGrid({
  report,
  colors,
  threshold,
}: {
  report: JndReport
  colors: string[]
  threshold: number
}) {
  const { tokens } = useTheme()
  const pageBg = tokens.bg
  const cells = useMemo(() => buildCells(report, threshold), [report, threshold])
  // each color measured against the app background, same tests as the report
  const swatchCells = useMemo(() => {
    const m = new Map<string, PairCell>()
    const titles = testTitles(report.tests)
    colors.forEach((c, i) => {
      const tests = colorVsBackground(c, pageBg, threshold, report)
      m.set(`s:${i}`, {
        normal: tests[0]?.pairs?.[0]?.deltaE ?? 0,
        tests: tests.map((t, k) => {
          const deltaE = t.pairs?.[0]?.deltaE ?? t.issues[0]?.deltaE ?? 0
          return { title: titles[k] ?? t.label, deltaE, fail: deltaE < threshold }
        }),
        failLetters: [],
      })
    })
    return m
  }, [report, colors, threshold, pageBg])
  const popCells = useMemo(
    () => new Map([...cells, ...swatchCells]),
    [cells, swatchCells]
  )
  const popover = useRef<PopoverHandle>(null)
  const lastTarget = useRef<Element | null>(null)

  // delegated: two listeners for the whole grid, one rect read per cell entry
  const onPointerOver = (e: React.PointerEvent) => {
    const el = (e.target as Element).closest('[data-pair]')
    if (el === lastTarget.current) return
    lastTarget.current = el
    if (el) {
      popover.current?.show(el.getAttribute('data-pair')!, el)
    } else {
      popover.current?.hide()
    }
  }
  const onPointerLeave = () => {
    lastTarget.current = null
    popover.current?.hide()
  }

  return (
    <>
      <div
        className="grid gap-y-1"
        style={{ gridTemplateColumns: `minmax(28px, auto) repeat(${colors.length - 1}, minmax(0, 1fr))` }}
        onPointerOver={onPointerOver}
        onPointerLeave={onPointerLeave}
      >
        <div />
        {colors.slice(0, -1).map((c, j) => (
          <div key={j} className="flex h-10 items-center justify-center">
            <HeaderSwatch color={c} index={j} cell={swatchCells.get(`s:${j}`)} pageBg={pageBg} />
          </div>
        ))}
        {colors.slice(1).map((rowColor, r) => {
          const i = r + 1
          return (
            <Fragment key={i}>
              <div className="flex h-[34px] items-center pr-3">
                <HeaderSwatch
                  color={rowColor}
                  index={i}
                  cell={swatchCells.get(`s:${i}`)}
                  pageBg={pageBg}
                />
              </div>
              {colors.slice(0, -1).map((colColor, j) => {
                if (j >= i) return <div key={j} />
                const cell = cells.get(`${j}:${i}`)
                const ratio = wcagContrast(rowColor, colColor)
                const failing = (cell?.failLetters.length ?? 0) > 0
                return (
                  <div
                    key={j}
                    data-pair={`${j}:${i}`}
                    className="flex h-[34px] cursor-default flex-col items-center justify-center rounded-md leading-tight hover:bg-ink/[0.04] data-active:bg-ink/[0.04]"
                  >
                    <span
                      className={`tabular-nums text-[13px] ${
                        failing ? 'font-medium text-danger/90' : 'text-ink/70'
                      }`}
                    >
                      {cell ? cell.normal.toFixed(1) : '—'}
                      {failing && (
                        <span className="ml-1 text-[9px] font-semibold tracking-[0.08em]">
                          {cell?.failLetters.join('')}
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums text-[11px] text-ink/30">
                      {ratio.toFixed(1)}
                    </span>
                  </div>
                )
              })}
            </Fragment>
          )
        })}
      </div>
      <PairPopover ref={popover} cells={popCells} colors={colors} pageBg={pageBg} />
    </>
  )
}

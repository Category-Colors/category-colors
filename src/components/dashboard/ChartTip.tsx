import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// Distance from the cursor to the nearest tooltip corner: far enough that the
// chip never sits on the mark being read, close enough to read as attached.
const GAP = 14
const MARGIN = 8

export interface TipRow {
  color: string
  label: string
  value: string
}

export interface Tip {
  x: number // client coords — the tooltip is fixed-positioned
  y: number
  /** The shared x value, for charts that read a whole column at once. */
  title?: string
  /** Ordered the way the marks stack on screen at this x, top row first. */
  rows: TipRow[]
  /** Index into `rows` of the series under the cursor; the rest are dimmed. */
  active?: number
}

// Cursor-following chip. There is no transform transition — it has to track
// the cursor exactly, not chase it — and no layout in React state either: the
// chip is measured and placed in a layout effect, before the browser paints.
export function ChartTip({ x, y, title, rows, active }: Tip) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { offsetWidth: w, offsetHeight: h } = el
    const left = x + GAP + w > window.innerWidth ? x - GAP - w : x + GAP
    // Prefer sitting above the cursor. A column listing every series is far
    // too tall for that, so it falls through to riding alongside the cursor,
    // clamped to the viewport rather than running off the bottom.
    let top = y - GAP - h
    if (top < MARGIN) {
      top = Math.max(MARGIN, Math.min(y - h / 2, window.innerHeight - h - MARGIN))
    }
    el.style.transform = `translate3d(${Math.round(Math.max(MARGIN, left))}px, ${Math.round(top)}px, 0)`
  })

  return createPortal(
    <div
      ref={ref}
      className="chart-tip"
      aria-hidden
    >
      {title && <div className="chart-tip-title">{title}</div>}
      {rows.map((row, i) => (
        <div
          key={row.label}
          className={`chart-tip-row${i === active ? ' is-active' : ''}`}
        >
          <span className="chart-tip-swatch" style={{ backgroundColor: row.color }} />
          <span>{row.label}</span>
          <span className="chart-tip-value">{row.value}</span>
        </div>
      ))}
    </div>,
    document.body
  )
}

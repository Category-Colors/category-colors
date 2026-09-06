import { useEffect, useLayoutEffect, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Tip } from './ChartTip'

// Client coords → viewBox user units. The charts scale with `w-full` and a
// default preserveAspectRatio, so both axes share the element's scale factor.
export function svgPoint(e: ReactPointerEvent<SVGSVGElement>, width: number, height: number) {
  const r = e.currentTarget.getBoundingClientRect()
  return {
    vx: ((e.clientX - r.left) / r.width) * width,
    vy: ((e.clientY - r.top) / r.height) * height,
  }
}

// Snap a fractional position along an axis to the sample it lands on.
export const clampIndex = (v: number, last: number) => Math.max(0, Math.min(last, Math.round(v)))

// Returns a CSS-pixel → user-unit converter for a chart's viewBox. Everything
// inside a viewBox is scaled by the element's width, so chrome measured in
// user units shrinks with the chart — 10px labels on a 1120-unit chart come
// out at 3px on a phone. Type, hairlines and hover rings are all real-world
// sizes rather than data, so they go through px() and stay put.
export function useChartPx(ref: RefObject<SVGSVGElement | null>, viewBoxWidth: number) {
  const [unit, setUnit] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const apply = (w: number) => w && setUnit(viewBoxWidth / w)
    apply(el.getBoundingClientRect().width) // before first paint; the observer only sees later changes
    const ro = new ResizeObserver(([entry]) => apply(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, viewBoxWidth])
  return (px: number) => px * unit
}

// Built once. toLocaleDateString builds a formatter per call, and these run
// inside render bodies that re-run on every pointer move — measured at 26µs a
// call against 0.4µs through a kept formatter.
const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: 'short' })

/** A forecast day (`2026-09-06`) as a short weekday, read at local noon so the
    label can't slip a day at either end of the UTC offset. */
export const weekday = (day: string) => WEEKDAY.format(new Date(`${day}T12:00`))

// Hover state that holds indices into a series, cleared whenever that series
// is rebuilt: shrinking the palette drops cities out from under the indices,
// and nothing else clears them — losing a city to a keyboard-driven delete
// fires no pointer event at all.
export function useHoverState<T>(series: unknown) {
  const [hover, setHover] = useState<T | null>(null)
  useEffect(() => setHover(null), [series])
  return [hover, setHover] as const
}

/** A tooltip for one mark — the shape every bar and dot chart wants. */
export const tipAt = (
  e: { clientX: number; clientY: number },
  color: string,
  label: string,
  value: string
): Tip => ({ x: e.clientX, y: e.clientY, rows: [{ color, label, value }] })

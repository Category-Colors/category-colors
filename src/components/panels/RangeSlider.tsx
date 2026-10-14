import { Fragment, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'motion/react'
import { SPRING, FADE } from '@/components/dialkit'
import { tidyWindows, type ChannelWindow } from '@/lib/palette'

const HANDLE_BUFFER = 8
const LABEL_CSS_LEFT = 10
const VALUE_CSS_RIGHT = 10

// A bound on the track: window `w`, lower (0) or upper (1) end
type Bound = [w: number, end: 0 | 1]

// Range slider matching the DialKit Slider look and behavior: label left,
// "lo–hi" values right, a filled band per window, hashmarks and handles that
// appear on hover (handles dodge the text). Dragging grabs the nearest bound
// of any window; clicking a number edits it. The + button opens another
// window in the widest gap, and dragging a window shut removes it.
export function RangeSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
}: {
  label: string
  value: ChannelWindow[]
  onChange: (value: ChannelWindow[]) => void
  min?: number
  max?: number
  step?: number
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const valueRef = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState<Bound | null>(null)
  const [inputValue, setInputValue] = useState('')
  const bound = useRef<Bound>([0, 0])

  const isActive = dragging || hovered
  const decimals = step >= 1 ? 0 : step >= 0.01 ? 2 : 3
  const fmt = (v: number) => v.toFixed(decimals)
  const pct = (v: number) => ((v - min) / (max - min)) * 100

  useEffect(() => {
    if (editing !== null && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  // The windows with one bound moved: it stays on its own side of its
  // partner and off the neighboring windows
  const withBound = ([w, end]: Bound, raw: number): ChannelWindow[] => {
    const [lo, hi] = value[w]
    const floor = end === 0 ? (value[w - 1]?.[1] ?? min) : lo
    const ceiling = end === 1 ? (value[w + 1]?.[0] ?? max) : hi
    const v = +Math.max(floor, Math.min(ceiling, raw)).toFixed(decimals)
    return value.map((window, i): ChannelWindow => (i === w ? (end === 0 ? [v, hi] : [lo, v]) : window))
  }
  const same = (a: ChannelWindow[], b: ChannelWindow[]) => JSON.stringify(a) === JSON.stringify(b)

  const valueAt = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect()
    const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const raw = min + p * (max - min)
    return min + Math.round((raw - min) / step) * step
  }

  const apply = (raw: number) => {
    const next = withBound(bound.current, raw)
    if (!same(next, value)) onChange(next)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (editing !== null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const v = valueAt(e.clientX)
    let nearest: Bound = [0, 0]
    let distance = Infinity
    value.forEach((window, w) =>
      window.forEach((b, end) => {
        // ties go to the later bound, so a click past a shut window reopens it
        if (Math.abs(v - b) <= distance) [nearest, distance] = [[w, end as 0 | 1], Math.abs(v - b)]
      })
    )
    bound.current = nearest
    setDragging(true)
    apply(v)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 || !dragging) return
    apply(valueAt(e.clientX))
  }

  // A window dragged shut is a window removed, as long as one remains
  const endDrag = () => {
    setDragging(false)
    const tidy = tidyWindows(value)
    if (!same(tidy, value)) onChange(tidy)
  }

  // Another window: in the widest gap, taking its middle third; with no gap
  // worth the name, the widest window splits into its outer thirds instead
  const addWindow = () => {
    const round = (n: number) => +n.toFixed(decimals)
    const edges = [min, ...value.flat(), max]
    const gaps = Array.from({ length: edges.length / 2 }, (_, i): ChannelWindow => [edges[2 * i], edges[2 * i + 1]])
    const widest = (spans: ChannelWindow[]) => spans.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a))
    const gap = widest(gaps)
    if (gap[1] - gap[0] >= 3 * step) {
      const third = (gap[1] - gap[0]) / 3
      return onChange(tidyWindows([...value, [round(gap[0] + third), round(gap[1] - third)]]))
    }
    const window = widest(value)
    const third = (window[1] - window[0]) / 3
    if (third < step) return
    const rest = value.filter((w) => w !== window)
    onChange(tidyWindows([...rest, [window[0], round(window[0] + third)], [round(window[1] - third), window[1]]]))
  }

  const startEdit = (which: Bound) => {
    setEditing(which)
    setInputValue(fmt(value[which[0]][which[1]]))
  }

  const commitInput = () => {
    if (editing !== null) {
      const parsed = Number(inputValue)
      if (Number.isFinite(parsed)) {
        const next = tidyWindows(withBound(editing, parsed))
        if (!same(next, value)) onChange(next)
      }
    }
    setEditing(null)
  }

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

  // Handles duck under the label (left) and value (right) text, like Slider
  let leftThreshold = 30
  let rightThreshold = 78
  const trackWidth = trackRef.current?.offsetWidth
  if (trackWidth && trackWidth > 0) {
    if (labelRef.current) {
      leftThreshold = ((LABEL_CSS_LEFT + labelRef.current.offsetWidth + HANDLE_BUFFER) / trackWidth) * 100
    }
    if (valueRef.current) {
      rightThreshold =
        ((trackWidth - VALUE_CSS_RIGHT - valueRef.current.offsetWidth - HANDLE_BUFFER) / trackWidth) * 100
    }
  }

  const discreteSteps = (max - min) / step
  const marks =
    discreteSteps <= 10
      ? Array.from({ length: Math.max(0, Math.round(discreteSteps) - 1) }, (_, i) =>
          (((i + 1) * step) / (max - min)) * 100
        )
      : Array.from({ length: 9 }, (_, i) => (i + 1) * 10)

  // Every bound as an editable number, "lo–hi" per window, windows separated
  // by commas. One window sits in the track; several go on a line below it,
  // where they don't cover the bands.
  const bounds = value.flatMap((window, w) => window.map((_, end): Bound => [w, end as 0 | 1])).map(([w, end]) => (
    <Fragment key={`${w}-${end}`}>
      {end === 1 ? <span className="range-slider-dash">–</span> : w > 0 && <span className="range-slider-dash">,</span>}
      {editing?.[0] === w && editing[1] === end ? (
        <input
          ref={inputRef}
          type="text"
          className="range-slider-input"
          style={{ width: `${Math.max(inputValue.length, 2) + 0.5}ch`, textAlign: end === 0 ? 'right' : 'left' }}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitInput()
            else if (e.key === 'Escape') setEditing(null)
          }}
          onBlur={commitInput}
          onClick={stop}
        />
      ) : (
        <button
          type="button"
          className="range-slider-num"
          aria-label={`Edit ${end === 0 ? 'lower' : 'upper'} ${label.toLowerCase()} bound${value.length > 1 ? ` of window ${w + 1}` : ''}`}
          onClick={() => startEdit([w, end])}
        >
          {fmt(value[w][end])}
        </button>
      )}
    </Fragment>
  ))

  return (
    <div className="range-slider-wrapper">
      <div
        ref={trackRef}
        className={`range-slider ${isActive ? 'range-slider-active' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        role="group"
        aria-label={label}
      >
        <div className="dialkit-slider-hashmarks">
          {marks.map((p) => (
            <div key={p} className="dialkit-slider-hashmark" style={{ left: `${p}%` }} />
          ))}
        </div>
        {value.map(([lo, hi], w) => (
          <div key={w} className="range-slider-fill" style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }} />
        ))}
        {value.flat().map((v, i) => {
          const p = pct(v)
          const dodge = p < leftThreshold || p > rightThreshold
          return (
            <motion.div
              key={i}
              className="range-slider-handle"
              style={{ left: `clamp(5px, ${p}%, calc(100% - 5px))`, x: '-50%', y: '-50%' }}
              animate={{
                opacity: !isActive ? 0 : dodge ? 0.1 : dragging ? 0.9 : 0.5,
                scaleX: isActive ? 1 : 0.25,
                scaleY: isActive && dodge ? 0.75 : 1,
              }}
              transition={{ scaleX: SPRING.glyph, scaleY: SPRING.glyph, opacity: FADE }}
            />
          )
        })}
        <span ref={labelRef} className="range-slider-label">
          {label}
        </span>
        <span
          ref={valueRef}
          className="range-slider-value"
          onMouseDown={stop}
          onPointerDown={stop}
        >
          {value.length === 1 && bounds}
          <button
            type="button"
            className="range-slider-add"
            aria-label={`Add a ${label.toLowerCase()} window`}
            title="Add a window"
            onClick={addWindow}
          >
            +
          </button>
        </span>
      </div>
      {value.length > 1 && <div className="range-slider-windows">{bounds}</div>}
    </div>
  )
}

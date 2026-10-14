import { Fragment, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'motion/react'
import { SPRING, FADE } from '@/components/dialkit'
import { decimalsForStep, roundValue } from '@/components/dialkit/shortcut-utils'
import { MAX_WINDOWS, tidyWindows, type ChannelWindow } from '@/lib/palette'

const HANDLE_BUFFER = 8
const LABEL_CSS_LEFT = 10
const VALUE_CSS_RIGHT = 10

// Range slider matching the DialKit Slider look and behavior: label left,
// "lo–hi" values right, a filled band per window, hashmarks and handles that
// appear on hover (handles dodge the text). Dragging grabs the nearest bound
// of any window; clicking a number edits it. The + button opens another
// window in the widest gap, and dragging a window shut removes it.
//
// Bounds are addressed by their index in the flattened windows: bound i is
// window i >> 1, lower (0) or upper (1) end i & 1.
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
  // While dragging, the windows as the hand has them, shut ones included;
  // the parent only ever gets the tidy version, so it never holds a shut or
  // overlapping window and nothing downstream has to cope with one.
  const [drag, setDrag] = useState<ChannelWindow[] | null>(null)
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [inputValue, setInputValue] = useState('')
  const bound = useRef(0)

  const shown = drag ?? value
  const isActive = drag !== null || hovered
  const fmt = (v: number) => v.toFixed(decimalsForStep(step))
  const pct = (v: number) => ((v - min) / (max - min)) * 100

  useEffect(() => {
    if (editing !== null && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])
  // The windows can change under an edit (a restore, a preset, a tool call);
  // an edit of a bound that's gone is dropped rather than committed
  useEffect(() => {
    if (editing !== null && value.flat()[editing] === undefined) setEditing(null)
  }, [editing, value])

  // The windows with one bound moved, kept on its own side of its partner;
  // the same array when nothing moves
  const withBound = (windows: ChannelWindow[], i: number, raw: number): ChannelWindow[] => {
    const window = windows[i >> 1]
    if (!window) return windows
    const end = i & 1
    const v = roundValue(Math.max(end ? window[0] : min, Math.min(end ? max : window[1], raw)), step)
    if (v === window[end]) return windows
    return windows.map((w, j): ChannelWindow => (j === i >> 1 ? (end ? [w[0], v] : [v, w[1]]) : w))
  }

  const valueAt = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect()
    const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return roundValue(min + p * (max - min), step)
  }

  const apply = (windows: ChannelWindow[], raw: number) => {
    const next = withBound(windows, bound.current, raw)
    if (next === windows) return
    setDrag(next)
    onChange(tidyWindows(next))
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (editing !== null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const v = valueAt(e.clientX)
    let distance = Infinity
    value.flat().forEach((b, i) => {
      // a tie is a shut window: the click's side says which bound reopens it
      const d = Math.abs(v - b)
      if (d < distance || (d === distance && (v < b ? !(i & 1) : i & 1))) [bound.current, distance] = [i, d]
    })
    setDrag(value)
    apply(value, v)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 || !drag) return
    apply(drag, valueAt(e.clientX))
  }

  const endDrag = () => setDrag(null)

  // Another window: in the widest gap, taking its middle third; with no gap
  // worth the name, the widest window splits into its outer thirds instead
  const addWindow = () => {
    if (value.length >= MAX_WINDOWS) return
    const gaps: ChannelWindow[] = [[min, value[0][0]], ...value.slice(1).map((w, i): ChannelWindow => [value[i][1], w[0]]), [value.at(-1)![1], max]]
    const widest = (spans: ChannelWindow[]) => spans.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a))
    const gap = widest(gaps)
    if (gap[1] - gap[0] >= 3 * step) {
      const third = (gap[1] - gap[0]) / 3
      return onChange(tidyWindows([...value, [roundValue(gap[0] + third, step), roundValue(gap[1] - third, step)]]))
    }
    const window = widest(value)
    const third = (window[1] - window[0]) / 3
    if (third < step) return
    const rest = value.filter((w) => w !== window)
    onChange(tidyWindows([...rest, [window[0], roundValue(window[0] + third, step)], [roundValue(window[1] - third, step), window[1]]]))
  }

  const startEdit = (i: number) => {
    setEditing(i)
    setInputValue(fmt(value.flat()[i]))
  }

  const commitInput = () => {
    if (editing !== null) {
      const parsed = Number(inputValue)
      const next = Number.isFinite(parsed) ? withBound(value, editing, parsed) : value
      if (next !== value) onChange(tidyWindows(next))
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
  const bounds = shown.flat().map((v, i) => (
    <Fragment key={i}>
      {i & 1 ? <span className="range-slider-dash">–</span> : i > 0 && <span className="range-slider-dash">,</span>}
      {editing === i ? (
        <input
          ref={inputRef}
          type="text"
          className="range-slider-input"
          style={{ width: `${Math.max(inputValue.length, 2) + 0.5}ch`, textAlign: i & 1 ? 'left' : 'right' }}
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
          aria-label={`Edit ${i & 1 ? 'upper' : 'lower'} ${label.toLowerCase()} bound${shown.length > 1 ? ` of window ${(i >> 1) + 1}` : ''}`}
          onClick={() => startEdit(i)}
        >
          {fmt(v)}
        </button>
      )}
    </Fragment>
  ))

  return (
    <div>
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
        {shown.map(([lo, hi], w) => (
          <div key={w} className="range-slider-fill" style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }} />
        ))}
        {shown.flat().map((v, i) => {
          const p = pct(v)
          const dodge = p < leftThreshold || p > rightThreshold
          return (
            <motion.div
              key={i}
              className="range-slider-handle"
              style={{ left: `clamp(5px, ${p}%, calc(100% - 5px))`, x: '-50%', y: '-50%' }}
              animate={{
                opacity: !isActive ? 0 : dodge ? 0.1 : drag ? 0.9 : 0.5,
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
          className="range-slider-value range-slider-nums"
          onMouseDown={stop}
          onPointerDown={stop}
        >
          {shown.length === 1 && bounds}
          {value.length < MAX_WINDOWS && (
            <button
              type="button"
              className="range-slider-add"
              aria-label={`Add a ${label.toLowerCase()} window`}
              title="Add a window"
              onClick={addWindow}
            >
              +
            </button>
          )}
        </span>
      </div>
      {shown.length > 1 && <div className="range-slider-windows range-slider-nums">{bounds}</div>}
    </div>
  )
}

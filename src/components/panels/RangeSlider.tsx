import { Fragment, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { motion } from 'motion/react'
import { SPRING, FADE } from '@/components/dialkit'
import { decimalsForStep, roundValue } from '@/components/dialkit/shortcut-utils'
import { MAX_WINDOWS, tidyWindows, type ChannelWindow } from '@/lib/palette'
import { PlusIcon, XIcon } from './icons'

const HANDLE_BUFFER = 8
const LABEL_CSS_LEFT = 10
const VALUE_CSS_RIGHT = 10

// Range slider matching the DialKit Slider look and behavior: label left,
// "lo–hi" values right, a filled band, hashmarks and handles that appear on
// hover (handles dodge the text). With several windows the label becomes a
// group header over a compact row per window: its own track left, its numbers
// right. Dragging grabs the nearest bound on that track; clicking a number
// edits it. The + button opens another window in the widest gap; a row's ×,
// or dragging a window shut, removes it.
//
// Bounds are addressed by their index in the flattened windows: bound i is
// window i >> 1, lower (0) or upper (1) end i & 1.
//
// On a channel with a period (hue), an arc through zero is stored as two windows,
// one from the bottom and one to the top. It shows as the one range it is: one
// row, numbered "350–60", with both bands on its track, and the two bounds at
// the seam left out of reach.
export function RangeSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  period,
}: {
  label: string
  value: ChannelWindow[]
  onChange: (value: ChannelWindow[]) => void
  min?: number
  max?: number
  step?: number
  // set on a cyclic channel, whose ends are the same point
  period?: number
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const valueRef = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // While dragging, the windows as the hand has them, shut ones included;
  // the parent only ever gets the tidy version, so it never holds a shut or
  // overlapping window and nothing downstream has to cope with one.
  const [drag, setDrag] = useState<ChannelWindow[] | null>(null)
  // Which track is hovered or dragged: -1 the single dial, w a window's row
  const [hovered, setHovered] = useState<number | null>(null)
  const [dragTrack, setDragTrack] = useState<number | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [inputValue, setInputValue] = useState('')
  const bound = useRef(0)
  const rect = useRef<DOMRect | null>(null)
  // The ranges as rows, each a list of window indices: one window, or the two
  // halves of an arc through zero (top half first). Held through a drag, so a
  // range that opens or closes the seam mid-drag doesn't regroup under the hand.
  const groupsOf = (windows: ChannelWindow[]) => {
    const n = windows.length
    if (period === undefined || n < 2 || windows[0][0] !== min || windows[n - 1][1] !== max) return windows.map((_, w) => [w])
    return [...windows.slice(1, -1).map((_, w) => [w + 1]), [n - 1, 0]]
  }
  const dragGroups = useRef<number[][]>([])

  const shown = drag ?? value
  const flat = shown.flat()
  const groups = drag ? dragGroups.current : groupsOf(value)
  // A range's two outer bounds: its first window's lower, its last's upper
  const ends = (group: number[]) => [2 * group[0], 2 * group[group.length - 1] + 1]
  const activeTrack = dragTrack ?? hovered
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
    // An arc's outer ends stop a step short of each other instead of the
    // channel's ends: meeting would close it into the whole circle
    const arc = groups.find((group) => group.length > 1 && ends(group).includes(i))
    const across = arc && windows.flat()[ends(arc).find((j) => j !== i)!]
    const lo = end ? window[0] : across !== undefined ? across + step : min
    const hi = end ? (across !== undefined ? across - step : max) : window[1]
    const v = roundValue(Math.max(lo, Math.min(hi, raw)), step)
    if (v === window[end]) return windows
    return windows.map((w, j): ChannelWindow => (j === i >> 1 ? (end ? [w[0], v] : [v, w[1]]) : w))
  }

  const valueAt = (clientX: number) => {
    const { left, width } = rect.current!
    const p = Math.max(0, Math.min(1, (clientX - left) / width))
    return roundValue(min + p * (max - min), step)
  }

  const apply = (windows: ChannelWindow[], raw: number) => {
    const next = withBound(windows, bound.current, raw)
    if (next === windows) return
    setDrag(next)
    onChange(tidyWindows(next))
  }

  // A press grabs the nearest of the track's bounds: any of them on the single
  // dial, its own window's two on a window's row
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>, key: number, indices: number[]) => {
    if (editing !== null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    rect.current = e.currentTarget.getBoundingClientRect()
    const v = valueAt(e.clientX)
    const flat = value.flat()
    let distance = Infinity
    for (const i of indices) {
      // a tie is a shut window: the click's side says which bound reopens it
      const d = Math.abs(v - flat[i])
      if (d < distance || (d === distance && (v < flat[i] ? !(i & 1) : i & 1))) [bound.current, distance] = [i, d]
    }
    dragGroups.current = groupsOf(value)
    setDrag(value)
    setDragTrack(key)
    apply(value, v)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 || !drag) return
    apply(drag, valueAt(e.clientX))
  }

  const endDrag = () => {
    setDrag(null)
    setDragTrack(null)
  }

  // Another window: in the widest gap, taking its middle third; with no gap
  // worth the name, the widest window splits into its outer thirds instead.
  // With a period, the space above the last window and below the first is
  // one gap through zero, and a window there is stored as an arc.
  const addWindow = () => {
    if (value.length >= MAX_WINDOWS) return
    const inner = value.slice(1).map((w, i): ChannelWindow => [value[i][1], w[0]])
    const gaps: ChannelWindow[] =
      period !== undefined
        ? [[value.at(-1)![1], value[0][0] + period], ...inner]
        : [[min, value[0][0]], ...inner, [value.at(-1)![1], max]]
    const wrap = (v: number) => (period !== undefined && v > period ? v - period : v)
    const widest = (spans: ChannelWindow[]) => spans.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a))
    const gap = widest(gaps)
    if (gap[1] - gap[0] >= 3 * step) {
      const third = (gap[1] - gap[0]) / 3
      return onChange(tidyWindows([...value, [wrap(roundValue(gap[0] + third, step)), wrap(roundValue(gap[1] - third, step))]], period))
    }
    const window = widest(value)
    const third = (window[1] - window[0]) / 3
    if (third < step) return
    const rest = value.filter((w) => w !== window)
    // Around a whole circle the outer thirds would meet at the seam, one arc
    // again, so the second one stops a half third short of the top instead
    const shift = period !== undefined && window[0] === min && window[1] === max ? third / 2 : 0
    onChange(tidyWindows([...rest, [window[0], roundValue(window[0] + third, step)], [roundValue(window[1] - third - shift, step), roundValue(window[1] - shift, step)]]))
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

  // A range's bounds as editable numbers, "lo–hi"
  const bounds = (indices: number[], row: number) =>
    indices.map((i) => (
      <Fragment key={i}>
        {i & 1 ? <span className="range-slider-dash">–</span> : null}
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
            aria-label={`Edit ${i & 1 ? 'upper' : 'lower'} ${label.toLowerCase()} bound${groups.length > 1 ? ` of window ${row + 1}` : ''}`}
            onClick={() => startEdit(i)}
          >
            {fmt(flat[i])}
          </button>
        )}
      </Fragment>
    ))

  const addButton = value.length < MAX_WINDOWS && (
    <button
      type="button"
      className="range-slider-add"
      aria-label={`Add a ${label.toLowerCase()} window`}
      title="Add a window"
      onClick={addWindow}
    >
      +
    </button>
  )

  // A track: the whole channel, with a band per window of its range and a
  // handle on each of the range's ends. `dodge` gives the handle thresholds
  // for text laid over the track, if any.
  const track = (key: number, windows: number[], children: ReactNode, dodge?: [number, number]) => {
    const isActive = activeTrack === key
    const indices = ends(windows)
    return (
      <div
        ref={key === -1 ? trackRef : undefined}
        className={`range-slider ${key === -1 ? '' : 'range-slider-compact'} ${isActive ? 'range-slider-active' : ''}`}
        onPointerDown={(e) => onPointerDown(e, key, indices)}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onMouseEnter={() => setHovered(key)}
        onMouseLeave={() => setHovered((h) => (h === key ? null : h))}
        role="group"
        aria-label={key === -1 ? label : `${label} window ${key + 1}`}
      >
        <div className="dialkit-slider-hashmarks">
          {marks.map((p) => (
            <div key={p} className="dialkit-slider-hashmark" style={{ left: `${p}%` }} />
          ))}
        </div>
        {windows.map((w) => {
          const [lo, hi] = shown[w]
          return <div key={w} className="range-slider-fill" style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }} />
        })}
        {indices.map((i) => {
          const p = pct(flat[i])
          const ducked = !!dodge && (p < dodge[0] || p > dodge[1])
          return (
            <motion.div
              key={i}
              className="range-slider-handle"
              style={{ left: `clamp(5px, ${p}%, calc(100% - 5px))`, x: '-50%', y: '-50%' }}
              animate={{
                opacity: !isActive ? 0 : ducked ? 0.1 : drag ? 0.9 : 0.5,
                scaleX: isActive ? 1 : 0.25,
                scaleY: isActive && ducked ? 0.75 : 1,
              }}
              transition={{ scaleX: SPRING.glyph, scaleY: SPRING.glyph, opacity: FADE }}
            />
          )
        })}
        {children}
      </div>
    )
  }

  // One range is the full dial, label and numbers laid over the track.
  // Several are a group under the label, a compact row per range with its
  // track on the left and its numbers on the right.
  if (groups.length === 1) {
    return track(
      -1,
      groups[0],
      <>
        <span ref={labelRef} className="range-slider-label">
          {label}
        </span>
        <span ref={valueRef} className="range-slider-value range-slider-nums" onMouseDown={stop} onPointerDown={stop}>
          {bounds(ends(groups[0]), 0)}
          {addButton}
        </span>
      </>,
      [leftThreshold, rightThreshold]
    )
  }
  return (
    <div className="range-slider-group" role="group" aria-label={label}>
      <div className="range-slider-group-header">
        <span>{label}</span>
        {/* the same icon button as the rows' ×, so it sits right above them */}
        {value.length < MAX_WINDOWS && (
          <button className="color-row-icon" aria-label={`Add a ${label.toLowerCase()} window`} onClick={addWindow}>
            <PlusIcon />
          </button>
        )}
      </div>
      {groups.map((group, row) => (
        <div key={row} className="range-slider-row">
          {track(row, group, null)}
          <span className="range-slider-nums range-slider-row-value">{bounds(ends(group), row)}</span>
          <button
            className="color-row-icon"
            aria-label={`Remove ${label.toLowerCase()} window ${row + 1}`}
            onClick={() => onChange(value.filter((_, j) => !group.includes(j)))}
          >
            <XIcon />
          </button>
        </div>
      ))}
    </div>
  )
}

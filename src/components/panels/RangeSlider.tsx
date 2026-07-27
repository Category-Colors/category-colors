import { Fragment, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'motion/react'
import { SPRING, FADE } from '@/components/dialkit'

const HANDLE_BUFFER = 8
const LABEL_CSS_LEFT = 10
const VALUE_CSS_RIGHT = 10

// Dual-thumb range slider matching the DialKit Slider look and behavior:
// label left, "lo–hi" value right, filled band between the bounds, hashmarks
// and handles that appear on hover (handles dodge the text). Dragging grabs
// the nearer bound; clicking either number edits it directly.
export function RangeSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
}: {
  label: string
  value: [number, number]
  onChange: (value: [number, number]) => void
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
  const [editing, setEditing] = useState<0 | 1 | null>(null)
  const [inputValue, setInputValue] = useState('')
  const bound = useRef<0 | 1>(0)

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

  const clampToBound = (which: 0 | 1, raw: number): [number, number] => {
    const v = +Math.max(min, Math.min(max, raw)).toFixed(decimals)
    return which === 0 ? [Math.min(v, value[1]), value[1]] : [value[0], Math.max(v, value[0])]
  }

  const valueAt = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect()
    const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round((min + p * (max - min)) / step) * step
  }

  const apply = (raw: number) => {
    const next = clampToBound(bound.current, raw)
    if (next[0] !== value[0] || next[1] !== value[1]) onChange(next)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (editing !== null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const v = valueAt(e.clientX)
    bound.current = Math.abs(v - value[0]) <= Math.abs(v - value[1]) ? 0 : 1
    setDragging(true)
    apply(v)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 || !dragging) return
    apply(valueAt(e.clientX))
  }

  const endDrag = () => setDragging(false)

  const startEdit = (which: 0 | 1) => {
    setEditing(which)
    setInputValue(fmt(value[which]))
  }

  const commitInput = () => {
    if (editing !== null) {
      const parsed = parseFloat(inputValue)
      if (Number.isFinite(parsed)) {
        const next = clampToBound(editing, parsed)
        if (next[0] !== value[0] || next[1] !== value[1]) onChange(next)
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
      >
        <div className="dialkit-slider-hashmarks">
          {marks.map((p) => (
            <div key={p} className="dialkit-slider-hashmark" style={{ left: `${p}%` }} />
          ))}
        </div>
        <div
          className="range-slider-fill"
          style={{ left: `${pct(value[0])}%`, width: `${pct(value[1]) - pct(value[0])}%` }}
        />
        {value.map((v, i) => {
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
          {([0, 1] as const).map((i) => (
            <Fragment key={i}>
              {i === 1 && <span className="range-slider-dash">–</span>}
              {editing === i ? (
                <input
                  ref={inputRef}
                  type="text"
                  className="range-slider-input"
                  style={{
                    width: `${Math.max(inputValue.length, 2) + 0.5}ch`,
                    textAlign: i === 0 ? 'right' : 'left',
                  }}
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
                <span className="range-slider-num" onClick={() => startEdit(i)}>
                  {fmt(value[i])}
                </span>
              )}
            </Fragment>
          ))}
        </span>
      </div>
    </div>
  )
}

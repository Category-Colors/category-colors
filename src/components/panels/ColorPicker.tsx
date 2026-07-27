import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { SpaceSelect } from '@/components/SpaceSelect'
import {
  convertValue,
  hexValue,
  hsvToHex,
  hsvToValue,
  valueToHsv,
  type ColorValue,
  type Hsv,
  type Space,
} from '@/lib/color'

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> }
const eyeDropper = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

const SPACE_OPTIONS = (['hex', 'rgb', 'hsl', 'oklch', 'oklab'] as Space[]).map((value) => ({
  value,
  label: value.toUpperCase(),
}))

interface ChannelDef {
  key: string
  label: string
  min: number
  max: number
  decimals: number
}

const CHANNELS: Record<Exclude<Space, 'hex'>, ChannelDef[]> = {
  rgb: [
    { key: 'r', label: 'R', min: 0, max: 255, decimals: 0 },
    { key: 'g', label: 'G', min: 0, max: 255, decimals: 0 },
    { key: 'b', label: 'B', min: 0, max: 255, decimals: 0 },
  ],
  hsl: [
    { key: 'h', label: 'H', min: 0, max: 360, decimals: 1 },
    { key: 's', label: 'S %', min: 0, max: 100, decimals: 1 },
    { key: 'l', label: 'L %', min: 0, max: 100, decimals: 1 },
  ],
  oklch: [
    { key: 'l', label: 'L', min: 0, max: 1, decimals: 3 },
    { key: 'c', label: 'C', min: 0, max: 0.5, decimals: 3 },
    { key: 'h', label: 'H', min: 0, max: 360, decimals: 1 },
  ],
  oklab: [
    { key: 'l', label: 'L', min: 0, max: 1, decimals: 3 },
    { key: 'a', label: 'A', min: -0.4, max: 0.4, decimals: 3 },
    { key: 'b', label: 'B', min: -0.4, max: 0.4, decimals: 3 },
  ],
}

function PipetteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 22 1-1h3l9-9" />
      <path d="M3 21v-3l9-9" />
      <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
    </svg>
  )
}

// Saturation/value area + hue slider + eyedropper + per-channel inputs in the
// color's own space. Controlled by a ColorValue prop; internal HSV state keeps
// hue stable while dragging through grays where the value can't express it.
export function ColorPicker({
  value,
  onChange,
}: {
  value: ColorValue
  onChange: (value: ColorValue) => void
}) {
  const [hsv, setHsv] = useState<Hsv>(() => valueToHsv(value))
  const [draft, setDraft] = useState<{ key: string; text: string } | null>(null)
  const lastEmitted = useRef(value)

  useEffect(() => {
    if (JSON.stringify(value) === JSON.stringify(lastEmitted.current)) return
    setHsv(valueToHsv(value))
    lastEmitted.current = value
  }, [value])

  // Drags: hsv is the source of truth, converted into the stored space
  const emitFromHsv = (next: Hsv) => {
    setHsv(next)
    const nextValue = hsvToValue(value.space, next)
    lastEmitted.current = nextValue
    onChange(nextValue)
  }

  // Typed input / eyedropper / space switch: the value is the source of truth
  const applyValue = (next: ColorValue) => {
    setHsv(valueToHsv(next))
    lastEmitted.current = next
    onChange(next)
  }

  const svPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.type === 'pointerdown') e.currentTarget.setPointerCapture(e.pointerId)
    else if (e.buttons !== 1) return
    const rect = e.currentTarget.getBoundingClientRect()
    const s = clamp01((e.clientX - rect.left) / rect.width)
    const v = 1 - clamp01((e.clientY - rect.top) / rect.height)
    emitFromHsv([hsv[0], s, v])
  }

  const huePointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.type === 'pointerdown') e.currentTarget.setPointerCapture(e.pointerId)
    else if (e.buttons !== 1) return
    const rect = e.currentTarget.getBoundingClientRect()
    emitFromHsv([clamp01((e.clientX - rect.left) / rect.width) * 360, hsv[1], hsv[2]])
  }

  const commitDraft = () => {
    if (!draft) return
    if (value.space === 'hex') {
      const m = /^#?([0-9a-f]{6})$/i.exec(draft.text.trim())
      if (m) applyValue(hexValue(`#${m[1].toUpperCase()}`))
    } else {
      const def = CHANNELS[value.space].find((d) => d.key === draft.key)
      const n = parseFloat(draft.text)
      if (def && Number.isFinite(n)) {
        const p = 10 ** def.decimals
        const clamped = Math.round(Math.max(def.min, Math.min(def.max, n)) * p) / p
        applyValue({ ...value, [draft.key]: clamped } as ColorValue)
      }
    }
    setDraft(null)
  }

  const pickFromScreen = async () => {
    try {
      const result = await new eyeDropper!().open()
      applyValue(convertValue(hexValue(result.sRGBHex.toUpperCase()), value.space))
    } catch {
      // user cancelled
    }
  }

  const inputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
    else if (e.key === 'Escape') {
      e.stopPropagation() // cancel the edit without closing the popover
      setDraft(null)
    }
  }

  return (
    <div className="color-picker">
      <div
        className="picker-sv"
        style={{ '--picker-hue': `hsl(${hsv[0]}, 100%, 50%)` } as CSSProperties}
        onPointerDown={svPointer}
        onPointerMove={svPointer}
      >
        <div
          className="picker-handle"
          style={{
            left: `${hsv[1] * 100}%`,
            top: `${(1 - hsv[2]) * 100}%`,
            backgroundColor: hsvToHex(hsv),
          }}
        />
      </div>
      <div className="picker-hue" onPointerDown={huePointer} onPointerMove={huePointer}>
        <div
          className="picker-handle"
          style={{
            left: `${(hsv[0] / 360) * 100}%`,
            top: '50%',
            backgroundColor: `hsl(${hsv[0]}, 100%, 50%)`,
          }}
        />
      </div>
      <div className="picker-io">
        {eyeDropper && (
          <button className="picker-eyedropper" aria-label="Pick from screen" onClick={pickFromScreen}>
            <PipetteIcon />
          </button>
        )}
        <SpaceSelect
          value={value.space}
          options={SPACE_OPTIONS}
          onChange={(space) => applyValue(convertValue(value, space))}
          label="Color space"
        />
      </div>
      {value.space === 'hex' ? (
        <div className="picker-channels">
          <label className="picker-channel">
            <input
              value={draft?.key === 'hex' ? draft.text : value.hex.toUpperCase()}
              onFocus={() => setDraft({ key: 'hex', text: value.hex.toUpperCase() })}
              onChange={(e) => setDraft({ key: 'hex', text: e.target.value })}
              onBlur={commitDraft}
              onKeyDown={inputKeyDown}
              spellCheck={false}
            />
            <span>Hex</span>
          </label>
        </div>
      ) : (
        <div className="picker-channels">
          {CHANNELS[value.space].map((def) => (
            <label key={def.key} className="picker-channel">
              <input
                value={
                  draft?.key === def.key
                    ? draft.text
                    : String((value as unknown as Record<string, number>)[def.key])
                }
                onFocus={() =>
                  setDraft({
                    key: def.key,
                    text: String((value as unknown as Record<string, number>)[def.key]),
                  })
                }
                onChange={(e) => setDraft({ key: def.key, text: e.target.value })}
                onBlur={commitDraft}
                onKeyDown={inputKeyDown}
                inputMode="decimal"
                spellCheck={false}
              />
              <span>{def.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

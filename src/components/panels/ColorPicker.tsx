import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { clampChroma, converter } from 'culori'
import type { Color } from 'culori'
import { SpaceSelect } from '@/components/SpaceSelect'
import {
  convertValue,
  hexValue,
  hsvToHex,
  hsvToValue,
  valueToCss,
  valueToHsv,
  type ColorValue,
  type Hsv,
  type Space,
} from '@/lib/color'
import { ICON_STROKE } from '@/components/panels/icons'

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

// The pick surface in the color's own space, so dragging moves the numbers in
// the inputs below: a plane of two channels at the slider's third, with the
// sRGB gamut stretched to fill it. hex and rgb have no plane that reads
// well, so they keep HSV, the surface every picker uses for them.
type PlaneSpace = 'hsl' | 'oklch' | 'oklab'
interface Plane {
  slider: ChannelDef
  sliderBackground: string
  // The plane position whose color marks the slider's handle
  swatch: [x: number, y: number]
  // Where a value sits on the plane, both axes 0–1 with y upward
  toSquare(value: ColorValue): [x: number, y: number]
  // The value at a plane position, under a slider setting
  fromSquare(slider: number, x: number, y: number): ColorValue
  // The value after a slider move, with the handle staying put on the
  // plane and the other channels left as they were where that's possible
  withSlider(value: ColorValue, slider: number): ColorValue
  // A function of plane position to paint one slider setting with; it may
  // precompute whatever that setting needs
  painter(slider: number): (x: number, y: number) => Color
}

const HUE_RAINBOW = 'linear-gradient(to right, #f00, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00)'

const channel = (space: Exclude<Space, 'hex'>, key: string) => CHANNELS[space].find((d) => d.key === key)!
const roundTo = (def: ChannelDef, n: number) => {
  const p = 10 ** def.decimals
  return Math.round(Math.max(def.min, Math.min(def.max, n)) * p) / p
}
// A chroma-like channel at most `limit` from gray: rounded to nearest, then
// stepped toward gray only when that lands past the limit. Nearest keeps a
// handle from drifting over repeated slider moves; the step keeps edge picks
// inside the gamut.
const roundIn = (def: ChannelDef, n: number, limit: number) => {
  const nearest = roundTo(def, n)
  return Math.abs(nearest) <= Math.abs(limit) + 1e-9 ? nearest : roundTo(def, nearest - Math.sign(n) * 10 ** -def.decimals)
}

const toRgb = converter('rgb')

// The most chroma sRGB holds at a lightness and hue (OKLCH): culori's clamp
// bisects down from a ceiling no sRGB color reaches. The plane's x axis
// runs from gray to this edge.
const maxChroma = (l: number, h: number) => clampChroma({ mode: 'oklch', l, c: 0.4, h }, 'oklch').c

// OKLAB's a/b plane at a lightness is a blob, which the elliptical grid
// mapping (Fong) turns into a square: polar position scaled by the gamut
// edge in that direction becomes a disc, and the disc becomes the square.
const discToSquare = (u: number, v: number): [number, number] => {
  const sq = (n: number) => Math.sqrt(Math.max(0, n))
  const x = (sq(2 + u * u - v * v + 2 * Math.SQRT2 * u) - sq(2 + u * u - v * v - 2 * Math.SQRT2 * u)) / 2
  const y = (sq(2 - u * u + v * v + 2 * Math.SQRT2 * v) - sq(2 - u * u + v * v - 2 * Math.SQRT2 * v)) / 2
  return [(x + 1) / 2, (y + 1) / 2]
}
const squareToDisc = (x: number, y: number): [number, number] => {
  const X = 2 * x - 1
  const Y = 2 * y - 1
  return [X * Math.sqrt(1 - (Y * Y) / 2), Y * Math.sqrt(1 - (X * X) / 2)]
}
const degrees = (rad: number) => ((rad * 180) / Math.PI + 360) % 360

const PLANES: Record<PlaneSpace, Plane> = {
  hsl: {
    slider: channel('hsl', 'h'),
    sliderBackground: HUE_RAINBOW,
    swatch: [1, 0.5],
    toSquare: (value) => (value.space === 'hsl' ? [value.s / channel('hsl', 's').max, value.l / channel('hsl', 'l').max] : [0, 0]),
    fromSquare: (h, x, y) => ({ space: 'hsl', h, s: roundTo(channel('hsl', 's'), x * channel('hsl', 's').max), l: roundTo(channel('hsl', 'l'), y * channel('hsl', 'l').max) }),
    withSlider: (value, h) => ({ ...value, h }) as ColorValue,
    painter: (h) => (x, y) => ({ mode: 'hsl', h, s: x, l: y }),
  },
  oklch: {
    slider: channel('oklch', 'h'),
    sliderBackground: 'linear-gradient(to right in oklch longer hue, oklch(0.72 0.14 0), oklch(0.72 0.14 360))',
    swatch: [0.6, 0.72],
    toSquare: (value) => {
      if (value.space !== 'oklch') return [0, 0]
      const max = maxChroma(value.l, value.h)
      return [max ? Math.min(1, value.c / max) : 0, value.l]
    },
    fromSquare: (h, x, y) => {
      const l = roundTo(channel('oklch', 'l'), y)
      const max = maxChroma(l, h)
      return { space: 'oklch', l, c: roundIn(channel('oklch', 'c'), x * max, max), h }
    },
    withSlider: (value, h) => {
      if (value.space !== 'oklch') return value
      const [x] = PLANES.oklch.toSquare(value)
      const max = maxChroma(value.l, h)
      return { ...value, h, c: roundIn(channel('oklch', 'c'), x * max, max) }
    },
    painter: (h) => {
      const edge = new Map<number, number>()
      return (x, y) => {
        let max = edge.get(y)
        if (max === undefined) edge.set(y, (max = maxChroma(y, h)))
        return { mode: 'oklch', l: y, c: x * max, h }
      }
    },
  },
  oklab: {
    slider: channel('oklab', 'l'),
    sliderBackground: 'linear-gradient(to right, #000, #fff)',
    swatch: [0.5, 0.5],
    toSquare: (value) => {
      if (value.space !== 'oklab') return [0, 0]
      const angle = Math.atan2(value.b, value.a)
      const max = maxChroma(value.l, degrees(angle))
      const r = max ? Math.min(1, Math.hypot(value.a, value.b) / max) : 0
      return discToSquare(r * Math.cos(angle), r * Math.sin(angle))
    },
    fromSquare: (l, x, y) => {
      const [u, v] = squareToDisc(x, y)
      const angle = Math.atan2(v, u)
      const c = Math.hypot(u, v) * maxChroma(l, degrees(angle))
      const [a, b] = [c * Math.cos(angle), c * Math.sin(angle)]
      return { space: 'oklab', l, a: roundIn(channel('oklab', 'a'), a, a), b: roundIn(channel('oklab', 'b'), b, b) }
    },
    // a and b have to move with lightness to stay inside the gamut
    withSlider: (value, l) => PLANES.oklab.fromSquare(l, ...PLANES.oklab.toSquare(value)),
    painter: (l) => {
      const STEPS = 360
      const edge = Array.from({ length: STEPS }, (_, i) => maxChroma(l, (i * 360) / STEPS))
      return (x, y) => {
        const [u, v] = squareToDisc(x, y)
        const angle = Math.atan2(v, u)
        const c = Math.hypot(u, v) * edge[Math.round(degrees(angle)) % STEPS]
        return { mode: 'oklab', l, a: c * Math.cos(angle), b: c * Math.sin(angle) }
      }
    },
  },
}

const isPlaneSpace = (space: Space): space is PlaneSpace => space in PLANES

// Paints the plane at a slider setting, low resolution and stretched by CSS
const PLANE_W = 140
const PLANE_H = 70
function paintPlane(canvas: HTMLCanvasElement, plane: Plane, slider: number) {
  const color = plane.painter(slider)
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(PLANE_W, PLANE_H)
  const data = image.data
  for (let row = 0; row < PLANE_H; row++) {
    const y = 1 - (row + 0.5) / PLANE_H
    for (let col = 0; col < PLANE_W; col++) {
      const { r, g, b } = toRgb(color((col + 0.5) / PLANE_W, y))
      const i = (row * PLANE_W + col) * 4
      data[i] = Math.round(clamp01(r) * 255)
      data[i + 1] = Math.round(clamp01(g) * 255)
      data[i + 2] = Math.round(clamp01(b) * 255)
      data[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
}

function PipetteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ICON_STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 22l1-1h3l9-9M3 21v-3l9-9M15 6l3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
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

  // The surface's three numbers: HSV for hex and rgb, the space's own
  // channels otherwise. Slider first, then the plane's x and y.
  const space = value.space
  const plane = isPlaneSpace(space) ? PLANES[space] : null
  const channels = value as unknown as Record<string, number>
  const sliderValue = plane ? channels[plane.slider.key] : hsv[0]
  const sliderFraction = plane ? (sliderValue - plane.slider.min) / (plane.slider.max - plane.slider.min) : hsv[0] / 360
  const [xFraction, yFraction] = plane ? plane.toSquare(value) : [hsv[1], hsv[2]]

  // Before paint, so the plane never shows the slider's previous setting
  // under a handle already at the new one
  const planeRef = useRef<HTMLCanvasElement>(null)
  useLayoutEffect(() => {
    if (plane && planeRef.current) paintPlane(planeRef.current, plane, sliderValue)
  }, [plane, sliderValue])

  // A pointer position on the surface, as fractions of its width and height
  const pointerFractions = (e: ReactPointerEvent<HTMLDivElement>): [number, number] | null => {
    if (e.type === 'pointerdown') e.currentTarget.setPointerCapture(e.pointerId)
    else if (e.buttons !== 1) return null
    const rect = e.currentTarget.getBoundingClientRect()
    return [clamp01((e.clientX - rect.left) / rect.width), 1 - clamp01((e.clientY - rect.top) / rect.height)]
  }

  const svPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const at = pointerFractions(e)
    if (!at) return
    if (!plane) return emitFromHsv([hsv[0], at[0], at[1]])
    applyValue(plane.fromSquare(sliderValue, at[0], at[1]))
  }

  const huePointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const at = pointerFractions(e)
    if (!at) return
    if (!plane) return emitFromHsv([at[0] * 360, hsv[1], hsv[2]])
    const def = plane.slider
    applyValue(plane.withSlider(value, roundTo(def, def.min + at[0] * (def.max - def.min))))
  }

  const commitDraft = () => {
    if (!draft) return
    if (value.space === 'hex') {
      const m = /^#?([0-9a-f]{6})$/i.exec(draft.text.trim())
      if (m) applyValue(hexValue(`#${m[1].toUpperCase()}`))
    } else {
      const def = channel(value.space, draft.key)
      const n = Number(draft.text)
      if (Number.isFinite(n)) applyValue({ ...value, [draft.key]: roundTo(def, n) } as ColorValue)
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
        className={plane ? 'picker-sv' : 'picker-sv picker-sv-hsv'}
        style={plane ? undefined : ({ '--picker-hue': `hsl(${hsv[0]}, 100%, 50%)` } as CSSProperties)}
        onPointerDown={svPointer}
        onPointerMove={svPointer}
      >
        {plane && <canvas ref={planeRef} className="picker-plane" width={PLANE_W} height={PLANE_H} />}
        <div
          className="picker-handle"
          style={{
            left: `${xFraction * 100}%`,
            top: `${(1 - yFraction) * 100}%`,
            backgroundColor: plane ? valueToCss(value) : hsvToHex(hsv),
          }}
        />
      </div>
      <div
        className="picker-hue"
        style={{ background: plane ? plane.sliderBackground : HUE_RAINBOW }}
        onPointerDown={huePointer}
        onPointerMove={huePointer}
      >
        <div
          className="picker-handle"
          style={{
            left: `${sliderFraction * 100}%`,
            top: '50%',
            backgroundColor: plane
              ? valueToCss(plane.fromSquare(sliderValue, ...plane.swatch))
              : `hsl(${hsv[0]}, 100%, 50%)`,
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
                value={draft?.key === def.key ? draft.text : String(channels[def.key])}
                onFocus={() => setDraft({ key: def.key, text: String(channels[def.key]) })}
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
